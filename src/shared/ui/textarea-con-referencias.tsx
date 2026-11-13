"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { segmentarPorReferencias } from "@/configuracion/referencias/parser";
import { ETIQUETA_TIPO_REFERENCIA, ICONO_TIPO_REFERENCIA, type OpcionReferencia } from "@/configuracion/referencias/tipos";

// Textarea que entiende referencias `@tipo:clave` (ver
// src/configuracion/referencias/). Al escribir `@` abre el menú anclado al
// cursor; al elegir, inserta el token completo — el usuario nunca escribe el
// prefijo a mano.
//
// Los tokens se pintan como enlaces mediante una capa espejo detrás del
// textarea: el textarea lleva el texto transparente y la capa de abajo lo
// repite con los tokens resaltados. Un <textarea> no admite estilos por
// tramo, y un contenteditable (como editor-contenido-plantilla.tsx)
// cambiaría pegado, undo y selección en bloques largos como el prompt del
// agente — que es justo lo que no queremos tocar.

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
  onScroll,
  ref: refExterna,
  ...props
}: TextareaConReferenciasProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);

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
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  const menuAbierto = disparador !== null && posicion !== null && montado;

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

  /** La capa de resaltado tiene que seguir al textarea cuando se desplaza. */
  const sincronizarScroll = useCallback(() => {
    const el = ref.current;
    const capa = capaRef.current;
    if (!el || !capa) return;
    capa.scrollTop = el.scrollTop;
    capa.scrollLeft = el.scrollLeft;
  }, []);

  useEffect(sincronizarScroll, [value, sincronizarScroll]);

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

  // Token roto = el que la verificación no pudo resolver. Se pinta distinto
  // de uno válido para que se note sin tener que leer la tira de abajo.
  const tokensRotos = useMemo(
    () => new Set(estadoReferencias.filter((r) => r.etiqueta === null).map((r) => r.token)),
    [estadoReferencias],
  );

  const segmentos = useMemo(() => segmentarPorReferencias(value), [value]);

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
      <div className="relative">
        {/* Capa espejo: mismas métricas de caja que el textarea (padding,
            borde, tipografía, salto de línea) para que cada carácter caiga
            en el mismo píxel. Solo cambian los colores. */}
        <div
          ref={capaRef}
          aria-hidden
          className={cn(
            // Mismas métricas que el <textarea> base: padding, borde, tamaño
            // y quiebre de línea. `scrollbar-gutter` tiene que coincidir o
            // las dos capas envuelven a anchos distintos.
            "pointer-events-none absolute inset-0 rounded-lg border px-2.5 py-2 text-base whitespace-pre-wrap break-words [scrollbar-gutter:stable] md:text-sm",
            // La capa de abajo es la que lleva el fondo y el borde visibles:
            // el textarea de arriba va transparente para no lavar el texto.
            className,
            // Después de `className` a propósito: el alto y el overflow que
            // trae el consumidor son para el textarea, no para esta capa
            // (si no, aparece una segunda barra de scroll).
            "h-auto w-auto overflow-hidden",
          )}
        >
          {segmentos.map((s, i) =>
            s.esReferencia ? (
              <span
                key={i}
                className={cn(
                  "rounded-[3px] underline decoration-dotted underline-offset-2",
                  tokensRotos.has(s.texto)
                    ? "bg-destructive/15 text-destructive decoration-destructive/60"
                    : "bg-lime-400/10 text-lime-300 decoration-lime-400/50",
                )}
              >
                {s.texto}
              </span>
            ) : (
              <span key={i}>{s.texto}</span>
            ),
          )}
          {/* Un texto terminado en salto de línea colapsaría la última línea
              de la capa y desalinearía el scroll. */}
          {"\n"}
        </div>

        <Textarea
          ref={asignarRef}
          value={value}
          className={cn(
            "relative [scrollbar-gutter:stable]",
            className,
            // El texto lo dibuja la capa de abajo; acá solo queda el cursor.
            // La selección va semitransparente para que se siga leyendo lo
            // que hay debajo. El borde transparente no afecta al de foco:
            // `focus-visible:border-ring` es otra variante y sigue ganando.
            "border-transparent bg-transparent text-transparent caret-stone-50 selection:bg-lime-400/30 selection:text-transparent",
          )}
          onChange={(e) => {
            onChange(e.target.value);
            evaluarDisparador();
          }}
          onClick={evaluarDisparador}
          onKeyUp={evaluarDisparador}
          onScroll={(e) => {
            sincronizarScroll();
            onScroll?.(e);
          }}
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
      </div>

      {/* Por portal a <body>: dentro de un modal, el `transform` del diálogo
          vuelve relativo el `position: fixed` del menú y lo deja fuera de
          vista — el mismo problema ya resuelto en
          editor-contenido-plantilla.tsx. */}
      {menuAbierto &&
        createPortal(
          <MenuAutocomplete
            items={items}
            consulta={disparador.consulta}
            posicion={posicion}
            ayuda="Plantillas, usuarios y productos — escribe para filtrar"
            onSeleccionar={insertar}
            onCerrar={cerrar}
          />,
          document.body,
        )}

      {!ocultarResumen && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {estadoReferencias.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-stone-500">
              <AtSign className="h-3 w-3" />
              Escribe <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono">@</kbd> para
              referenciar una plantilla, un usuario o un producto
            </span>
          ) : (
            <>
              <span className="text-stone-500">Referencias:</span>
              {resueltas.map((r) => (
                <span
                  key={r.token}
                  title={r.token}
                  className="inline-flex items-center gap-1 rounded-md border border-lime-500/25 bg-lime-500/10 px-1.5 py-0.5 font-medium text-lime-300"
                >
                  {r.etiqueta}
                </span>
              ))}
              {sinResolver.map((r) => (
                <span
                  key={r.token}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-destructive"
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
