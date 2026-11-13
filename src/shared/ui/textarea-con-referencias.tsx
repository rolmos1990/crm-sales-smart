"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, TriangleAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  MenuAutocomplete,
  ALTO_MENU_AUTOCOMPLETE,
  ANCHO_MENU_AUTOCOMPLETE,
  type ItemAutocomplete,
} from "@/components/ui/menu-autocomplete";
import { cn } from "@/lib/utils";
import { posicionCaretTextarea, ubicarMenuJuntoAlCaret } from "./posicion-caret-textarea";
import { consultaActiva, type DisparadorReferencia } from "./disparador-referencias";
import { buscarReferenciasAction, verificarReferenciasAction } from "@/configuracion/referencias/actions";
import { ETIQUETA_TIPO_REFERENCIA, ICONO_TIPO_REFERENCIA, type OpcionReferencia } from "@/configuracion/referencias/tipos";

// Textarea que entiende referencias `@tipo:clave` (ver
// src/configuracion/referencias/). Al escribir `@` abre el menú anclado al
// cursor; al elegir, inserta el token completo — el usuario nunca escribe el
// prefijo a mano. Debajo muestra qué referencias quedaron escritas y cuáles
// no resuelven contra la instancia.
//
// Deliberadamente un <textarea> y no el editor con chips de
// editor-contenido-plantilla.tsx: ese es contenteditable y reescribe
// innerHTML, lo que cambiaría pegado, undo y selección en bloques largos de
// texto como las instrucciones del agente.

interface ItemReferencia extends ItemAutocomplete {
  opcion: OpcionReferencia;
}

interface TextareaConReferenciasProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "ref"> {
  value: string;
  onChange: (valor: string) => void;
  /** Oculta la tira de referencias (p.ej. en campos muy chicos). */
  ocultarResumen?: boolean;
  /** Apunta al <textarea> interno — quien lo recibe puede mover el cursor. */
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function TextareaConReferencias({
  value,
  onChange,
  ocultarResumen,
  className,
  onKeyDown,
  onBlur,
  ref: refExterna,
  ...props
}: TextareaConReferenciasProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // El textarea interno se necesita acá (posición del cursor, foco) y además
  // afuera: editor-respuestas-guia.tsx lo usa para insertar marcadores donde
  // está el cursor.
  const asignarRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ref.current = el;
      if (typeof refExterna === "function") refExterna(el);
      else if (refExterna) refExterna.current = el;
    },
    [refExterna],
  );
  const [disparador, setDisparador] = useState<DisparadorReferencia | null>(null);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const [opciones, setOpciones] = useState<OpcionReferencia[]>([]);
  const [estadoReferencias, setEstadoReferencias] = useState<
    { token: string; etiqueta: string | null }[]
  >([]);

  const menuAbierto = disparador !== null && posicion !== null;

  const evaluarDisparador = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const activo = consultaActiva(el.value, el.selectionStart ?? 0);
    setDisparador(activo);
    if (!activo) {
      setPosicion(null);
      return;
    }
    const caret = posicionCaretTextarea(el, activo.inicio);
    setPosicion(ubicarMenuJuntoAlCaret(caret, ANCHO_MENU_AUTOCOMPLETE, ALTO_MENU_AUTOCOMPLETE));
  }, []);

  // Candidatos del menú. Se pide al servidor en cada tecla porque el filtrado
  // cruza plantillas, usuarios y productos — listas que cambian mientras el
  // usuario edita.
  useEffect(() => {
    if (!disparador) return;
    let cancelado = false;
    buscarReferenciasAction(disparador.consulta)
      .then((res) => {
        if (!cancelado) setOpciones(res);
      })
      .catch(() => {
        if (!cancelado) setOpciones([]);
      });
    return () => {
      cancelado = true;
    };
  }, [disparador]);

  // Estado de lo ya escrito, para la tira de abajo. Con debounce: no hace
  // falta resolver en cada tecla.
  useEffect(() => {
    if (!value.includes("@")) {
      setEstadoReferencias([]);
      return;
    }
    const id = setTimeout(() => {
      verificarReferenciasAction(value)
        .then(setEstadoReferencias)
        .catch(() => setEstadoReferencias([]));
    }, 400);
    return () => clearTimeout(id);
  }, [value]);

  const items = useMemo<ItemReferencia[]>(
    () =>
      opciones.map((o) => ({
        id: o.token,
        grupo: `${ETIQUETA_TIPO_REFERENCIA[o.tipo]}s`,
        icono: ICONO_TIPO_REFERENCIA[o.tipo],
        etiqueta: o.etiqueta,
        detalle: o.detalle,
        opcion: o,
      })),
    [opciones],
  );

  const insertar = useCallback(
    (item: ItemReferencia) => {
      const el = ref.current;
      if (!el || !disparador) return;

      const cursor = el.selectionStart ?? value.length;
      const token = item.opcion.token;
      // Un espacio después para que seguir escribiendo no reabra el menú.
      const nuevo = `${value.slice(0, disparador.inicio)}${token} ${value.slice(cursor)}`;
      onChange(nuevo);
      setDisparador(null);
      setPosicion(null);

      requestAnimationFrame(() => {
        el.focus();
        const pos = disparador.inicio + token.length + 1;
        el.setSelectionRange(pos, pos);
      });
    },
    [disparador, onChange, value],
  );

  const cerrar = useCallback(() => {
    setDisparador(null);
    setPosicion(null);
  }, []);

  const sinResolver = estadoReferencias.filter((r) => r.etiqueta === null);
  const resueltas = estadoReferencias.filter((r) => r.etiqueta !== null);

  return (
    <div className="space-y-1.5">
      <Textarea
        ref={asignarRef}
        value={value}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          evaluarDisparador();
        }}
        onClick={evaluarDisparador}
        onKeyUp={evaluarDisparador}
        onKeyDown={(e) => {
          // Mientras el menú está abierto él se queda con las flechas, Enter,
          // Tab y Escape (los escucha en captura).
          if (!menuAbierto) onKeyDown?.(e);
        }}
        onBlur={(e) => {
          // Sin demora, el click sobre una opción cerraría el menú antes de
          // registrarse.
          setTimeout(cerrar, 150);
          onBlur?.(e);
        }}
        {...props}
      />

      {menuAbierto && (
        <MenuAutocomplete
          items={items}
          consulta={disparador.consulta}
          posicion={posicion}
          ayuda="Plantillas, usuarios y productos — escribe para filtrar"
          onSeleccionar={insertar}
          onCerrar={cerrar}
        />
      )}

      {!ocultarResumen && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {estadoReferencias.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <AtSign className="h-3 w-3" />
              Escribe <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono">@</kbd> para
              referenciar una plantilla, un usuario o un producto
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">Referencias:</span>
              {resueltas.map((r) => (
                <span
                  key={r.token}
                  title={r.token}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-stone-200"
                >
                  {r.etiqueta}
                </span>
              ))}
              {sinResolver.map((r) => (
                <span
                  key={r.token}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                    "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  <TriangleAlert className="h-3 w-3" />
                  {r.token} no existe
                </span>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
