"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Braces } from "lucide-react";
import { cn } from "@/lib/utils";
import { findVariableByKey, type VariableDefinition } from "@/configuracion/plantillas/variable-defs";
import { AutocompleteVariables } from "./autocomplete-variables";

// ─── Serialization ────────────────────────────────────────────────────────────

function toHTML(text: string): string {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withChips = escaped.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const v = findVariableByKey(key);
    const icon = v?.icon ?? "🔧";
    const label = v?.label ?? key;
    return `<span class="var-chip" data-key="${key}" contenteditable="false">${icon} ${label}</span>`;
  });
  return withChips.replace(/\n/g, "<br>");
}

function fromHTML(el: HTMLElement): string {
  let result = "";

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent ?? "").replace(/​/g, "");
      return;
    }
    const elem = node as HTMLElement;
    if (elem.dataset?.key) {
      result += `{{${elem.dataset.key}}}`;
      return;
    }
    const tag = elem.tagName;
    if (tag === "BR") { result += "\n"; return; }
    if (tag === "DIV" || tag === "P") {
      if (result.length > 0 && !result.endsWith("\n")) result += "\n";
      elem.childNodes.forEach(walk);
      return;
    }
    elem.childNodes.forEach(walk);
  }

  el.childNodes.forEach(walk);
  return result.replace(/\n+$/, "");
}

// ─── Trigger detection ────────────────────────────────────────────────────────

interface TriggerInfo {
  query: string;
  textNode: Text;
  caretOffset: number;
  triggerStart: number;
}

function getTrigger(editorEl: HTMLElement): TriggerInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const textNode = range.startContainer as Text;
  if (!editorEl.contains(textNode)) return null;

  const text = textNode.textContent ?? "";
  const offset = range.startOffset;
  const before = text.slice(0, offset);
  const triggerIdx = before.lastIndexOf("{{");
  if (triggerIdx === -1) return null;

  const query = before.slice(triggerIdx + 2);
  if (!/^[\w.]*$/.test(query)) return null;

  return { query, textNode, caretOffset: offset, triggerStart: triggerIdx };
}

// Computa la posición óptima del dropdown respecto al cursor del caret.
// Usa viewport coords porque el dropdown se renderiza via portal en document.body.
const DROPDOWN_H = 288; // max-h-72
const DROPDOWN_W = 288; // w-72

function getCaretViewportPos(): { top: number; left: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);

  const rects = range.getClientRects();
  const rect = rects.length ? rects[0] : range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height && !rect.top)) return null;

  const spaceBelow = window.innerHeight - rect.bottom;
  const top =
    spaceBelow >= DROPDOWN_H + 12
      ? rect.bottom + 6          // mostrar debajo del cursor
      : rect.top - DROPDOWN_H - 6; // mostrar arriba del cursor

  const left = Math.min(
    rect.left,
    window.innerWidth - DROPDOWN_W - 12
  );

  return { top: Math.max(8, top), left: Math.max(8, left) };
}

// ─── Public handle ────────────────────────────────────────────────────────────

export interface EditorContenidoHandle {
  insertVariable: (variable: VariableDefinition) => void;
  focus: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EditorContenidoProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const EditorContenidoPlantilla = forwardRef<EditorContenidoHandle, EditorContenidoProps>(
  function EditorContenidoPlantilla(
    { value, onChange, placeholder = "Escribe el contenido… usa {{ para insertar variables", className },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isFocusedRef = useRef(false);
    const lastPlainRef = useRef(value);
    const suppressRef = useRef(false);

    const [isEmpty, setIsEmpty] = useState(!value.trim());
    const [autocomplete, setAutocomplete] = useState<{
      query: string;
      pos: { top: number; left: number };
    } | null>(null);

    // ── Sync value → DOM cuando no está enfocado ────────────────────────────
    useEffect(() => {
      if (!isFocusedRef.current && editorRef.current) {
        const newHtml = toHTML(value);
        if (editorRef.current.innerHTML !== newHtml) {
          suppressRef.current = true;
          editorRef.current.innerHTML = newHtml;
          suppressRef.current = false;
          lastPlainRef.current = value;
          setIsEmpty(!value.trim());
        }
      }
    }, [value]);

    // ── Insertar chip de variable ──────────────────────────────────────────
    const insertVariable = useCallback(
      (variable: VariableDefinition) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        const trigger = getTrigger(el);
        const sel = window.getSelection();
        if (!sel) return;

        const chip = document.createElement("span");
        chip.className = "var-chip";
        chip.dataset.key = variable.key;
        chip.setAttribute("contenteditable", "false");
        chip.textContent = `${variable.icon} ${variable.label}`;

        if (trigger) {
          const { textNode, caretOffset, triggerStart } = trigger;
          const afterText = textNode.textContent?.slice(caretOffset) ?? "";
          textNode.textContent = textNode.textContent?.slice(0, triggerStart) ?? "";
          const afterNode = document.createTextNode(afterText || "");
          textNode.after(chip, afterNode);
          const range = document.createRange();
          range.setStart(afterNode, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else if (sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).startContainer)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(chip);
          const emptyAfter = document.createTextNode("");
          chip.after(emptyAfter);
          const newRange = document.createRange();
          newRange.setStart(emptyAfter, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          const emptyAfter = document.createTextNode("");
          el.append(chip, emptyAfter);
          const range = document.createRange();
          range.setStart(emptyAfter, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }

        const plain = fromHTML(el);
        lastPlainRef.current = plain;
        onChange(plain);
        setIsEmpty(!plain.trim());
        setAutocomplete(null);
      },
      [onChange]
    );

    useImperativeHandle(ref, () => ({
      insertVariable,
      focus: () => editorRef.current?.focus(),
    }));

    // ── Sync DOM → state ───────────────────────────────────────────────────
    const syncToState = useCallback(() => {
      if (suppressRef.current || !editorRef.current) return;
      const plain = fromHTML(editorRef.current);
      setIsEmpty(!plain.trim());
      if (plain !== lastPlainRef.current) {
        lastPlainRef.current = plain;
        onChange(plain);
      }
    }, [onChange]);

    const checkTrigger = useCallback(() => {
      if (!editorRef.current) return;
      const trigger = getTrigger(editorRef.current);
      if (trigger) {
        const pos = getCaretViewportPos();
        if (pos) setAutocomplete({ query: trigger.query, pos });
        else setAutocomplete(null);
      } else {
        setAutocomplete(null);
      }
    }, []);

    // ── Eventos nativos ────────────────────────────────────────────────────
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;

      const onInput = () => { syncToState(); checkTrigger(); };
      const onFocus = () => { isFocusedRef.current = true; };
      const onBlur = () => {
        isFocusedRef.current = false;
        setTimeout(() => setAutocomplete(null), 150);
      };
      const onKeyDown = (e: KeyboardEvent) => {
        // Enter: insertar <br> en vez de dejar que Chrome inserte <div>
        if (e.key === "Enter" && !autocomplete) {
          e.preventDefault();
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement("br");
          range.insertNode(br);
          let after = br.nextSibling;
          if (!after) { const extra = document.createElement("br"); br.after(extra); after = extra; }
          const newRange = document.createRange();
          newRange.setStartBefore(after);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          syncToState();
        }
      };
      const onPaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        document.execCommand("insertText", false, text);
      };

      el.addEventListener("input", onInput);
      el.addEventListener("focus", onFocus);
      el.addEventListener("blur", onBlur);
      el.addEventListener("keydown", onKeyDown);
      el.addEventListener("paste", onPaste);
      return () => {
        el.removeEventListener("input", onInput);
        el.removeEventListener("focus", onFocus);
        el.removeEventListener("blur", onBlur);
        el.removeEventListener("keydown", onKeyDown);
        el.removeEventListener("paste", onPaste);
      };
    }, [syncToState, checkTrigger, autocomplete]);

    // ── Carga inicial ──────────────────────────────────────────────────────
    useEffect(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = toHTML(value);
        lastPlainRef.current = value;
        setIsEmpty(!value.trim());
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Toolbar ────────────────────────────────────────────────────────────
    const toolbarAction = useCallback(
      (action: "bold" | "italic" | "variable") => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const selected = range.toString();

        if (action === "bold") {
          const node = document.createTextNode(`*${selected || "texto"}*`);
          range.deleteContents(); range.insertNode(node);
          const r = document.createRange(); r.setStartAfter(node); r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
        } else if (action === "italic") {
          const node = document.createTextNode(`_${selected || "texto"}_`);
          range.deleteContents(); range.insertNode(node);
          const r = document.createRange(); r.setStartAfter(node); r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
        } else if (action === "variable") {
          const node = document.createTextNode("{{");
          range.deleteContents(); range.insertNode(node);
          const r = document.createRange(); r.setStartAfter(node); r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
          checkTrigger();
        }
        syncToState();
      },
      [syncToState, checkTrigger]
    );

    return (
      <div className={cn("relative rounded-xl border border-white/10 bg-white/2", className)}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 bg-stone-900/40">
          <ToolbarBtn onAction={() => toolbarAction("bold")} title="Negrita (*texto*)">
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => toolbarAction("italic")} title="Cursiva (_texto_)">
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <ToolbarBtn onAction={() => toolbarAction("variable")} title='Insertar variable (escribir {{)' highlight>
            <Braces className="h-3.5 w-3.5" />
            <span className="text-[10px] font-mono ml-0.5">{"{ }"}</span>
          </ToolbarBtn>
        </div>

        {/* Área editable */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            className={cn(
              "min-h-[140px] max-h-[260px] overflow-y-auto p-3",
              "text-sm text-stone-100 leading-relaxed outline-none",
              "[&_.var-chip]:inline-flex [&_.var-chip]:items-center [&_.var-chip]:gap-1",
              "[&_.var-chip]:px-1.5 [&_.var-chip]:py-0.5 [&_.var-chip]:mx-0.5",
              "[&_.var-chip]:rounded [&_.var-chip]:text-xs [&_.var-chip]:font-medium",
              "[&_.var-chip]:bg-lime-500/15 [&_.var-chip]:text-lime-300",
              "[&_.var-chip]:border [&_.var-chip]:border-lime-500/25",
              "[&_.var-chip]:cursor-default [&_.var-chip]:select-none",
              "[&_.var-chip]:align-middle"
            )}
          />
          {isEmpty && (
            <div
              className="absolute top-3 left-3 text-sm text-stone-600 pointer-events-none select-none leading-relaxed"
              aria-hidden
            >
              {placeholder}
            </div>
          )}
        </div>

        {/* Autocomplete via portal — fuera del DOM del dialog para evitar
            que el CSS transform del modal afecte el position:fixed */}
        {autocomplete &&
          createPortal(
            <AutocompleteVariables
              query={autocomplete.query}
              position={autocomplete.pos}
              onSelect={insertVariable}
              onClose={() => setAutocomplete(null)}
            />,
            document.body
          )}
      </div>
    );
  }
);

function ToolbarBtn({
  children, onAction, title, highlight,
}: {
  children: React.ReactNode;
  onAction: () => void;
  title?: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors",
        highlight
          ? "text-lime-400 hover:bg-lime-500/10 hover:text-lime-300"
          : "text-stone-400 hover:text-stone-200 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}
