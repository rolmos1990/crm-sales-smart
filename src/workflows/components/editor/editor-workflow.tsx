"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudOff,
  Library,
  Loader2,
  Map as MapaIcono,
  Pencil,
  Redo2,
  ShieldCheck,
  Undo2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { cn } from "@/lib/utils";
import type { EstadoWorkflow } from "@/generated/prisma/enums";
import { CATALOGO_NODOS, salidaPorDefectoDeNodo, salidasDeNodo } from "../../definicion/catalogo-nodos";
import type { DefinicionWorkflow, NodoWorkflow, TipoNodo } from "../../definicion/schema";
import { validarEstructura, type ResultadoValidacion } from "../../definicion/validador";
import { actualizarDatosWorkflow, guardarBorradorWorkflow, publicarWorkflow, validarWorkflow } from "../../actions";
import type { OpcionesEditor } from "../../queries";
import { DialogoDatosWorkflow } from "../dialogo-datos-workflow";
import { ESTILO_CATEGORIA, ESTILO_ESTADO } from "../estilos";
import { BibliotecaNodos, TIPO_ARRASTRE } from "./biblioteca-nodos";
import { ControlesLienzo, type ModoLienzo } from "./controles-lienzo";
import { duplicarNodos, estadoInicial, generarId, quitarNodos, reducerEditor } from "./estado-editor";
import { MenuNodo } from "./menu-nodo";
import { NodoWorkflowFlow, type DatosNodoFlow, type NodoFlow } from "./nodo-workflow";
import { PanelPropiedades } from "./panel-propiedades";
import { PanelValidacion } from "./panel-validacion";
import { resumenNodo } from "./resumen-nodo";

const TIPOS_NODO_FLOW = { workflow: NodoWorkflowFlow };
const AUTOGUARDADO_MS = 1200;

/** Tipos que pueden intercalarse en una conexión: los que, recién creados,
 *  continúan el flujo por alguna salida. Un nodo terminal cortaría el tramo. */
const TIPOS_INSERTABLES = new Set(
  (Object.keys(CATALOGO_NODOS) as TipoNodo[]).filter(
    (t) => salidaPorDefectoDeNodo(t, CATALOGO_NODOS[t].configInicial()) !== null,
  ),
);

/** Compartido por todo nodo sano: evita un arreglo nuevo por nodo y por frame. */
const SIN_PROBLEMAS: string[] = [];

function mismosProblemas(a: string[], b: string[]): boolean {
  return a === b || (a.length === b.length && a.every((p, i) => p === b[i]));
}

type EstadoGuardado = "guardado" | "pendiente" | "guardando" | "error";

export interface DatosEditorWorkflow {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoWorkflow;
  versionPublicada: number | null;
  actualizadoEn: Date;
  definicion: DefinicionWorkflow;
}

export function EditorWorkflow(props: { workflow: DatosEditorWorkflow; opciones: OpcionesEditor; puedeModificar: boolean }) {
  return (
    <ReactFlowProvider>
      <TooltipProvider>
        <Editor {...props} />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}

function esCampoDeTexto(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[role=dialog],[role=listbox],[role=menu]");
}

/**
 * Id de la conexión bajo el cursor, si el cursor está sobre su trazo.
 *
 * React Flow marca cada arista con `data-id` y le da un trazo invisible de
 * `interactionWidth` px sensible al puntero. Se recorre la pila de elementos
 * de arriba hacia abajo y se corta en el primer nodo: una arista que pasa por
 * debajo de una tarjeta no cuenta como apuntada.
 */
function conexionBajoElCursor(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    // Lo que flota sobre el lienzo —tarjetas, mapa, controles, validación—
    // tapa la arista que pase por debajo: ahí no se está apuntando a ella.
    if (el.closest(".react-flow__node, .react-flow__panel, [data-sobre-lienzo]")) return null;
    const arista = el.closest(".react-flow__edge");
    if (arista) return arista.getAttribute("data-id");
  }
  return null;
}

function Editor({ workflow, opciones, puedeModificar }: { workflow: DatosEditorWorkflow; opciones: OpcionesEditor; puedeModificar: boolean }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow();
  const esEscritorio = useMediaQuery("(min-width: 1024px)");
  const soloLectura = !puedeModificar;

  const [estado, dispatch] = useReducer(reducerEditor, workflow.definicion, estadoInicial);
  const def = estado.definicion;

  const [datos, setDatos] = useState({ nombre: workflow.nombre, descripcion: workflow.descripcion, estado: workflow.estado, version: workflow.versionPublicada });
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [aristasSeleccionadas, setAristasSeleccionadas] = useState<string[]>([]);
  const [guardado, setGuardado] = useState<EstadoGuardado>("guardado");
  const [validacion, setValidacion] = useState<ResultadoValidacion | null>(null);
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const [modoLienzo, setModoLienzo] = useState<ModoLienzo>("seleccion");
  const [mapaVisible, setMapaVisible] = useState(true);
  const [actualizadoEn, setActualizadoEn] = useState(workflow.actualizadoEn);
  const [conexionDestacada, setConexionDestacada] = useState<string | null>(null);
  const [menuNodo, setMenuNodo] = useState<{ nodoId: string; x: number; y: number } | null>(null);
  const tipoArrastrado = useRef<TipoNodo | null>(null);
  // Tamaño con el que React Flow midió cada nodo. No va en la definición —
  // eso se guarda en base de datos— pero sí hay que devolvérselo en el nodo:
  // un objeto sin `measured` llega "sin medir" y React Flow lo esconde hasta
  // volver a medirlo. Ver `onNodesChange` y el memo de `nodos`.
  const medidas = useRef(new Map<string, { width: number; height: number }>());
  const [publicando, startPublicar] = useTransition();
  const [validando, startValidar] = useTransition();
  const portapapeles = useRef<{ nodos: NodoWorkflow[]; conexiones: DefinicionWorkflow["conexiones"] } | null>(null);
  const antesDeArrastrar = useRef<DefinicionWorkflow | null>(null);

  // ── Validación local (estructura) para marcar nodos en vivo ──────────────
  const validacionLocal = useMemo(() => validarEstructura(def), [def]);
  const problemasPorNodo = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const e of validacionLocal.errores) {
      if (!e.nodoId) continue;
      mapa.set(e.nodoId, [...(mapa.get(e.nodoId) ?? []), e.mensaje]);
    }
    return mapa;
  }, [validacionLocal]);

  // ── Autoguardado del borrador ───────────────────────────────────────────
  useEffect(() => {
    if (estado.revision === 0 || soloLectura) return;
    setGuardado("pendiente");
    const t = setTimeout(async () => {
      setGuardado("guardando");
      const r = await guardarBorradorWorkflow(workflow.id, def);
      setGuardado(r.exito ? "guardado" : "error");
      if (r.exito) setActualizadoEn(new Date());
      else toast.error(r.error);
    }, AUTOGUARDADO_MS);
    return () => clearTimeout(t);
    // def cambia junto con revision; revision es la señal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.revision]);

  useEffect(() => {
    if (guardado === "guardado") return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [guardado]);

  // ── Operaciones ───────────────────────────────────────────────────────────
  const aplicar = useCallback(
    (cambio: (d: DefinicionWorkflow) => DefinicionWorkflow, historial = true) => dispatch({ tipo: "APLICAR", cambio, historial }),
    [],
  );

  const agregarNodo = useCallback(
    (tipo: TipoNodo, posicion?: { x: number; y: number }, insertarEnConexion?: string) => {
      if (soloLectura) return;
      const id = generarId(tipo.toLowerCase());
      const centro = (() => {
        const { x, y, zoom } = getViewport();
        const el = document.querySelector(".react-flow");
        const ancho = el?.clientWidth ?? 800;
        const alto = el?.clientHeight ?? 600;
        return { x: (ancho / 2 - x) / zoom - 128, y: (alto / 2 - y) / zoom - 40 };
      })();
      const config = CATALOGO_NODOS[tipo].configInicial() as Record<string, unknown>;
      const nodo: NodoWorkflow = { id, tipo, posicion: posicion ?? centro, config };

      // Se calculan fuera del reducer: genera ids aleatorios y el reducer debe
      // ser puro (StrictMode lo ejecuta dos veces).
      const salida = salidaPorDefectoDeNodo(tipo, config);
      const idEntrada = generarId("c");
      const idSalida = generarId("c");

      aplicar((d) => {
        const conexion = insertarEnConexion ? d.conexiones.find((c) => c.id === insertarEnConexion) : undefined;
        if (!conexion || !salida) return { ...d, nodos: [...d.nodos, nodo] };
        // El tramo A → B pasa a ser A → nuevo → B, entrando por la salida que
        // ya tenía A y saliendo por el camino feliz del nuevo nodo.
        return {
          ...d,
          nodos: [...d.nodos, nodo],
          conexiones: [
            ...d.conexiones.filter((c) => c.id !== conexion.id),
            { id: idEntrada, origen: conexion.origen, salida: conexion.salida, destino: id },
            { id: idSalida, origen: id, salida, destino: conexion.destino },
          ],
        };
      });
      setSeleccion([id]);
      setBibliotecaAbierta(false);
    },
    [aplicar, getViewport, soloLectura],
  );

  const eliminarSeleccion = useCallback(() => {
    const ids = new Set(seleccion.filter((id) => def.nodos.find((n) => n.id === id)?.tipo !== "INICIO"));
    if (ids.size === 0 && aristasSeleccionadas.length === 0) return;
    const aristas = new Set(aristasSeleccionadas);
    aplicar((d) => {
      const sinNodos = quitarNodos(d, ids);
      return { ...sinNodos, conexiones: sinNodos.conexiones.filter((c) => !aristas.has(c.id)) };
    });
    setSeleccion([]);
    setAristasSeleccionadas([]);
  }, [aplicar, aristasSeleccionadas, def.nodos, seleccion]);

  const copiar = useCallback(() => {
    const ids = new Set(seleccion);
    if (ids.size === 0) return;
    portapapeles.current = {
      nodos: def.nodos.filter((n) => ids.has(n.id)),
      conexiones: def.conexiones.filter((c) => ids.has(c.origen) && ids.has(c.destino)),
    };
    toast.success(`${ids.size} ${ids.size === 1 ? "paso copiado" : "pasos copiados"}`);
  }, [def, seleccion]);

  const pegar = useCallback(
    (origen = portapapeles.current) => {
      if (!origen || soloLectura) return;
      // Se calcula fuera del reducer: genera ids aleatorios y el reducer debe
      // ser puro (StrictMode lo ejecuta dos veces).
      const r = duplicarNodos(def, origen);
      if (r.nuevosIds.length === 0) return;
      aplicar(() => r.definicion);
      setSeleccion(r.nuevosIds);
    },
    [aplicar, def, soloLectura],
  );

  // Clic derecho sobre un paso: si ya forma parte de una selección múltiple,
  // el menú actúa sobre toda; si no, pasa a ser el único seleccionado.
  const onNodeContextMenu = useCallback((e: React.MouseEvent, nodo: NodoFlow) => {
    e.preventDefault();
    setSeleccion((s) => (s.length > 1 && s.includes(nodo.id) ? s : [nodo.id]));
    setAristasSeleccionadas([]);
    setMenuNodo({ nodoId: nodo.id, x: e.clientX, y: e.clientY });
  }, []);

  /** Quita toda conexión que entre o salga de los pasos seleccionados. */
  const desconectarSeleccion = useCallback(() => {
    const ids = new Set(seleccion);
    if (ids.size === 0) return;
    aplicar((d) => ({ ...d, conexiones: d.conexiones.filter((c) => !ids.has(c.origen) && !ids.has(c.destino)) }));
  }, [aplicar, seleccion]);

  /** Copia los pasos seleccionados junto a sí mismos, con sus conexiones internas. */
  const duplicarSeleccion = useCallback(() => {
    const ids = new Set(seleccion);
    if (ids.size === 0) return;
    pegar({
      nodos: def.nodos.filter((n) => ids.has(n.id)),
      conexiones: def.conexiones.filter((c) => ids.has(c.origen) && ids.has(c.destino)),
    });
  }, [def, pegar, seleccion]);

  // ── Atajos de teclado ─────────────────────────────────────────────────────
  // Herramientas del lienzo: también en solo lectura, porque solo navegan.
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (esCampoDeTexto(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "v") setModoLienzo("seleccion");
      else if (tecla === "h") setModoLienzo("mano");
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, []);

  useEffect(() => {
    if (soloLectura) return;
    const manejar = (e: KeyboardEvent) => {
      if (esCampoDeTexto(e.target)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ tipo: "DESHACER" });
      } else if ((tecla === "z" && e.shiftKey) || tecla === "y") {
        e.preventDefault();
        dispatch({ tipo: "REHACER" });
      } else if (tecla === "c") {
        copiar();
      } else if (tecla === "v") {
        e.preventDefault();
        pegar();
      } else if (tecla === "d") {
        e.preventDefault();
        duplicarSeleccion();
      }
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [copiar, duplicarSeleccion, pegar, soloLectura]);

  // ── React Flow (controlado desde la definición) ───────────────────────────
  // React Flow conserva las dimensiones que midió de un nodo solo mientras el
  // objeto que se le pasa mantenga su identidad (`adoptUserNodes`, opción
  // `checkEquality`). Si cambia, las descarta y lo deja en `visibility:
  // hidden` hasta volver a medirlo: rehacer el arreglo entero en cada frame
  // del arrastre hacía parpadear todos los nodos a la vez. Por eso se reusa
  // el objeto anterior de cada nodo que no cambió.
  const nodosEmitidos = useRef(new Map<string, NodoFlow>());
  const opcionesEmitidas = useRef(opciones);

  const nodos: NodoFlow[] = useMemo(() => {
    // Los catálogos alimentan `resumen`: si cambian, hay que rehacer todo.
    if (opcionesEmitidas.current !== opciones) {
      opcionesEmitidas.current = opciones;
      nodosEmitidos.current = new Map();
    }
    const previos = nodosEmitidos.current;
    const actuales = new Map<string, NodoFlow>();

    const lista = def.nodos.map((n) => {
      const selected = seleccion.includes(n.id);
      const deletable = !soloLectura && n.tipo !== "INICIO";
      const problemas = problemasPorNodo.get(n.id) ?? SIN_PROBLEMAS;
      const previo = previos.get(n.id);
      // `n` encapsula posición, etiqueta y config, de donde salen `resumen` y
      // `salidas`: con el mismo objeto, lo derivado tampoco cambió.
      const sinCambios =
        previo !== undefined &&
        previo.data.nodo === n &&
        previo.selected === selected &&
        previo.deletable === deletable &&
        mismosProblemas(previo.data.problemas, problemas);

      const nodo: NodoFlow = sinCambios
        ? previo
        : {
            id: n.id,
            type: "workflow",
            position: n.posicion,
            selected,
            deletable,
            // Sin esto el nodo llegaría "sin medir" y se escondería un frame.
            measured: medidas.current.get(n.id),
            data: {
              nodo: n,
              resumen: resumenNodo(n, opciones),
              salidas: salidasDeNodo(n.tipo, n.config),
              problemas,
            },
          };
      actuales.set(n.id, nodo);
      return nodo;
    });

    nodosEmitidos.current = actuales;
    return lista;
  }, [def.nodos, opciones, problemasPorNodo, seleccion, soloLectura]);

  const aristas: Edge[] = useMemo(
    () =>
      def.conexiones.map((c) => {
        const destacada = c.id === conexionDestacada;
        return {
          id: c.id,
          source: c.origen,
          sourceHandle: c.salida,
          target: c.destino,
          targetHandle: "entrada",
          type: "smoothstep",
          selected: aristasSeleccionadas.includes(c.id),
          deletable: !soloLectura,
          interactionWidth: 20,
          // Destino del componente que se está arrastrando: se marca el tramo
          // y se avisa qué va a pasar al soltar.
          animated: destacada,
          zIndex: destacada ? 10 : undefined,
          style: destacada ? { stroke: "var(--primary)", strokeWidth: 2.5 } : undefined,
          label: destacada ? "Soltar para insertar aquí" : undefined,
          labelStyle: { fill: "var(--primary-foreground)", fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: "var(--primary)" },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 6,
        };
      }),
    [aristasSeleccionadas, conexionDestacada, def.conexiones, soloLectura],
  );

  const onNodesChange = useCallback(
    (cambios: NodeChange<NodoFlow>[]) => {
      const posiciones = new Map<string, { x: number; y: number }>();
      let nuevaSeleccion: Set<string> | null = null;
      const eliminar = new Set<string>();
      for (const c of cambios) {
        // Se anota, no se guarda: es tamaño de pantalla, no parte del flujo.
        if (c.type === "dimensions" && c.dimensions) medidas.current.set(c.id, c.dimensions);
        if (c.type === "position" && c.position) posiciones.set(c.id, c.position);
        if (c.type === "select") {
          nuevaSeleccion ??= new Set(seleccion);
          if (c.selected) nuevaSeleccion.add(c.id);
          else nuevaSeleccion.delete(c.id);
        }
        if (c.type === "remove") eliminar.add(c.id);
      }
      if (posiciones.size > 0) {
        aplicar(
          (d) => ({ ...d, nodos: d.nodos.map((n) => (posiciones.has(n.id) ? { ...n, posicion: posiciones.get(n.id)! } : n)) }),
          false,
        );
      }
      if (nuevaSeleccion) setSeleccion([...nuevaSeleccion]);
      if (eliminar.size > 0) {
        aplicar((d) => quitarNodos(d, new Set([...eliminar].filter((id) => d.nodos.find((n) => n.id === id)?.tipo !== "INICIO"))));
        setSeleccion((s) => s.filter((id) => !eliminar.has(id)));
        for (const id of eliminar) medidas.current.delete(id);
      }
    },
    [aplicar, seleccion],
  );

  const onEdgesChange = useCallback(
    (cambios: EdgeChange[]) => {
      const eliminar = new Set<string>();
      let nuevaSeleccion: Set<string> | null = null;
      for (const c of cambios) {
        if (c.type === "remove") eliminar.add(c.id);
        if (c.type === "select") {
          nuevaSeleccion ??= new Set(aristasSeleccionadas);
          if (c.selected) nuevaSeleccion.add(c.id);
          else nuevaSeleccion.delete(c.id);
        }
      }
      if (eliminar.size > 0) aplicar((d) => ({ ...d, conexiones: d.conexiones.filter((c) => !eliminar.has(c.id)) }));
      if (nuevaSeleccion) setAristasSeleccionadas([...nuevaSeleccion]);
    },
    [aplicar, aristasSeleccionadas],
  );

  const conexionValida = useCallback(
    (c: Connection | Edge) => {
      if (!c.source || !c.target || c.source === c.target) return false;
      return def.nodos.find((n) => n.id === c.target)?.tipo !== "INICIO";
    },
    [def.nodos],
  );

  // Conectar una salida ya usada la reemplaza: cada salida va a un solo destino.
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.sourceHandle || !conexionValida(c)) return;
      aplicar((d) => ({
        ...d,
        conexiones: [
          ...d.conexiones.filter((x) => !(x.origen === c.source && x.salida === c.sourceHandle)),
          { id: generarId("c"), origen: c.source, salida: c.sourceHandle!, destino: c.target },
        ],
      }));
    },
    [aplicar, conexionValida],
  );

  // Durante `dragover` el `dataTransfer` está bloqueado: el tipo que se
  // arrastra viene del ref que llenó la biblioteca al empezar.
  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const tipo = tipoArrastrado.current;
      const sobreConexion = tipo && !soloLectura && TIPOS_INSERTABLES.has(tipo);
      setConexionDestacada(sobreConexion ? conexionBajoElCursor(e.clientX, e.clientY) : null);
    },
    [soloLectura],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const conexion = conexionDestacada;
      setConexionDestacada(null);
      tipoArrastrado.current = null;
      const tipo = e.dataTransfer.getData(TIPO_ARRASTRE) as TipoNodo;
      if (!tipo || !(tipo in CATALOGO_NODOS)) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      agregarNodo(tipo, { x: p.x - 128, y: p.y - 30 }, conexion ?? undefined);
    },
    [agregarNodo, conexionDestacada, screenToFlowPosition],
  );

  // ── Validar / publicar ────────────────────────────────────────────────────
  const validar = () =>
    startValidar(async () => {
      const r = await validarWorkflow(workflow.id, def);
      if (!r.exito) return void toast.error(r.error);
      setValidacion(r.datos);
    });

  const publicar = () =>
    startPublicar(async () => {
      const r = await publicarWorkflow(workflow.id, def);
      if (!r.exito) {
        toast.error(r.error);
        if ("validacion" in r) setValidacion(r.validacion);
        return;
      }
      setGuardado("guardado");
      setValidacion(null);
      setDatos((d) => ({ ...d, estado: "PUBLICADO", version: r.datos.numero }));
      toast.success(`Workflow publicado (versión ${r.datos.numero})`);
      router.refresh();
    });

  const irANodo = (id: string) => {
    setSeleccion([id]);
    fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2 });
  };

  const nodoSeleccionado = seleccion.length === 1 ? def.nodos.find((n) => n.id === seleccion[0]) ?? null : null;
  const nodosSeleccionados = def.nodos.filter((n) => seleccion.includes(n.id));
  // Si el paso se borra con el menú abierto, el menú desaparece con él.
  const nodoDelMenu = menuNodo ? def.nodos.find((n) => n.id === menuNodo.nodoId) ?? null : null;
  const seleccionConConexiones = def.conexiones.some((c) => seleccion.includes(c.origen) || seleccion.includes(c.destino));
  const estiloEstado = ESTILO_ESTADO[datos.estado];
  const hayBorradorSinPublicar = datos.estado !== "BORRADOR" && estado.revision > 0;

  const panelPropiedades = nodoSeleccionado && (
    <PanelPropiedades
      nodo={nodoSeleccionado}
      definicion={def}
      opciones={opciones}
      problemas={problemasPorNodo.get(nodoSeleccionado.id) ?? []}
      soloLectura={soloLectura}
      onCambiar={(cambio) =>
        aplicar((d) => ({ ...d, nodos: d.nodos.map((n) => (n.id === nodoSeleccionado.id ? { ...n, ...cambio } : n)) }))
      }
      onDuplicar={() => pegar({ nodos: [nodoSeleccionado], conexiones: [] })}
      onEliminar={eliminarSeleccion}
      onCerrar={() => setSeleccion([])}
    />
  );

  return (
    <div className="flex h-full flex-col" data-slot="editor-workflow">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2">
        <Link
          href="/crm/workflows"
          aria-label="Volver a Workflows"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1">
            <Link href="/crm/workflows" className="hidden shrink-0 text-sm text-text-tertiary transition-colors hover:text-foreground sm:inline">
              Workflows
            </Link>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-text-disabled sm:block" />
            <h1 className="truncate text-sm font-semibold text-foreground">{datos.nombre}</h1>
          </nav>
          {!soloLectura && (
            <button
              type="button"
              aria-label="Renombrar"
              onClick={() => setRenombrando(true)}
              className="shrink-0 text-text-tertiary transition-colors hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", estiloEstado.clase)}>
            {datos.version ? `v${datos.version} · ` : ""}
            {estiloEstado.etiqueta}
          </span>
          {hayBorradorSinPublicar && (
            <span className="hidden shrink-0 rounded-full border border-warning/40 px-2 py-0.5 text-[11px] font-medium text-warning sm:inline">
              Cambios sin publicar
            </span>
          )}
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-text-tertiary xl:flex">
            Última actualización: <FechaHora valor={actualizadoEn} modo="relativa" />,{" "}
            <FechaHora valor={actualizadoEn} modo="hora" />
          </span>
        </div>

        {!soloLectura && (
          <div className="flex items-center gap-1">
            <IndicadorGuardado estado={guardado} />
            <div className="mx-1 hidden h-5 w-px bg-border md:block" />
            <BotonIcono etiqueta="Deshacer (Ctrl+Z)" disabled={estado.pasado.length === 0} onClick={() => dispatch({ tipo: "DESHACER" })}>
              <Undo2 className="h-4 w-4" />
            </BotonIcono>
            <BotonIcono etiqueta="Rehacer (Ctrl+Shift+Z)" disabled={estado.futuro.length === 0} onClick={() => dispatch({ tipo: "REHACER" })}>
              <Redo2 className="h-4 w-4" />
            </BotonIcono>
            {!esEscritorio && (
              <BotonIcono etiqueta="Componentes" onClick={() => setBibliotecaAbierta(true)}>
                <Library className="h-4 w-4" />
              </BotonIcono>
            )}
            <Button type="button" variant="outline" size="sm" className="ml-1" onClick={validar} disabled={validando}>
              {validando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <span className="hidden sm:inline">Validar</span>
            </Button>
            <Button type="button" size="sm" onClick={publicar} disabled={publicando}>
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publicar
            </Button>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Biblioteca */}
        {esEscritorio && !soloLectura && (
          <aside className="w-64 shrink-0 border-r border-border bg-card">
            <BibliotecaNodos
              onAgregar={agregarNodo}
              onArrastreInicio={(t) => (tipoArrastrado.current = t)}
              onArrastreFin={() => {
                tipoArrastrado.current = null;
                setConexionDestacada(null);
              }}
            />
          </aside>
        )}

        {/* Lienzo */}
        <div
          className="relative min-w-0 flex-1 bg-surface-1"
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            // `dragleave` también salta al pasar de un hijo a otro.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setConexionDestacada(null);
          }}
          onDrop={onDrop}
        >
          <ReactFlow<NodoFlow>
            nodes={nodos}
            edges={aristas}
            nodeTypes={TIPOS_NODO_FLOW}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={conexionValida}
            onNodeDragStart={() => (antesDeArrastrar.current = def)}
            onNodeDragStop={() => {
              if (antesDeArrastrar.current) dispatch({ tipo: "MARCAR_PUNTO_HISTORIAL", antes: antesDeArrastrar.current });
              antesDeArrastrar.current = null;
            }}
            onPaneClick={() => setSeleccion([])}
            onNodeContextMenu={onNodeContextMenu}
            // El menú se ancla al cursor: si el lienzo se mueve, deja de
            // corresponder con el paso y se cierra.
            onMove={() => setMenuNodo(null)}
            nodesDraggable={!soloLectura}
            nodesConnectable={!soloLectura}
            deleteKeyCode={soloLectura ? null : ["Backspace", "Delete"]}
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            // En modo selección el arrastre dibuja una caja y el lienzo se
            // mueve con los botones medio/derecho (o con Espacio).
            panOnDrag={modoLienzo === "mano" ? true : [1, 2]}
            selectionOnDrag={modoLienzo === "seleccion"}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            defaultEdgeOptions={{ type: "smoothstep" }}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            className={cn(modoLienzo === "mano" && "[&_.react-flow__pane]:cursor-grab")}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} className="opacity-70" />
            <ControlesLienzo modo={modoLienzo} onModo={setModoLienzo} />
            {esEscritorio && mapaVisible && (
              <MiniMap
                pannable
                zoomable
                ariaLabel="Mapa del Workflow"
                className="!m-3 overflow-hidden !rounded-xl !border !border-border !bg-card shadow-md"
                maskColor={resolvedTheme === "dark" ? "rgba(8,14,20,0.55)" : "rgba(32,40,48,0.08)"}
                nodeColor={(n) => ESTILO_CATEGORIA[CATALOGO_NODOS[(n.data as DatosNodoFlow).nodo.tipo].categoria].colorVar}
                nodeBorderRadius={4}
              />
            )}
          </ReactFlow>

          {esEscritorio && (
            <BotonIcono
              etiqueta={mapaVisible ? "Ocultar el mapa" : "Mostrar el mapa"}
              data-sobre-lienzo
              onClick={() => setMapaVisible((v) => !v)}
              className={cn(
                "absolute bottom-3 z-10 h-8 w-8 border border-border bg-card shadow-md hover:bg-card-hover",
                mapaVisible ? "right-[14rem]" : "right-3",
              )}
            >
              <MapaIcono className="h-4 w-4" />
            </BotonIcono>
          )}

          {menuNodo && nodoDelMenu && (
            <MenuNodo
              posicion={menuNodo}
              nodo={nodoDelMenu}
              seleccionados={nodosSeleccionados}
              conConexiones={seleccionConConexiones}
              soloLectura={soloLectura}
              onCerrar={() => setMenuNodo(null)}
              acciones={{
                onConfigurar: () => setSeleccion([nodoDelMenu.id]),
                onCopiar: copiar,
                onDuplicar: duplicarSeleccion,
                onDesconectar: desconectarSeleccion,
                onEliminar: eliminarSeleccion,
              }}
            />
          )}

          {validacion && (
            <div data-sobre-lienzo className="absolute inset-x-3 bottom-0 z-10 mx-auto max-w-2xl">
              <PanelValidacion resultado={validacion} onIrANodo={irANodo} onCerrar={() => setValidacion(null)} />
            </div>
          )}
          {!validacion && validacionLocal.errores.length > 0 && !soloLectura && (
            <button
              type="button"
              onClick={() => setValidacion(validacionLocal)}
              data-sobre-lienzo
              className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-danger-border bg-danger-muted px-3 py-1 text-xs font-medium text-danger-text shadow-sm"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {validacionLocal.errores.length} {validacionLocal.errores.length === 1 ? "problema" : "problemas"} por revisar
            </button>
          )}
        </div>

        {/* Propiedades */}
        {esEscritorio && panelPropiedades && (
          <aside className="w-80 shrink-0 border-l border-border bg-card">{panelPropiedades}</aside>
        )}
      </div>

      {/* Móvil / tablet: biblioteca y propiedades como hojas laterales */}
      {!esEscritorio && (
        <>
          <Sheet open={bibliotecaAbierta} onOpenChange={setBibliotecaAbierta}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Componentes</SheetTitle>
              </SheetHeader>
              <BibliotecaNodos
                onAgregar={agregarNodo}
                onArrastreInicio={(t) => (tipoArrastrado.current = t)}
                onArrastreFin={() => {
                  tipoArrastrado.current = null;
                  setConexionDestacada(null);
                }}
              />
            </SheetContent>
          </Sheet>
          <Sheet open={!!panelPropiedades} onOpenChange={(abierto) => !abierto && setSeleccion([])}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-sm">
              <SheetHeader className="sr-only">
                <SheetTitle>Propiedades del paso</SheetTitle>
              </SheetHeader>
              {panelPropiedades}
            </SheetContent>
          </Sheet>
        </>
      )}

      <DialogoDatosWorkflow
        abierto={renombrando}
        onAbiertoChange={setRenombrando}
        titulo="Editar Workflow"
        descripcion="Cambia el nombre o la descripción."
        textoAccion="Guardar"
        inicial={{ nombre: datos.nombre, descripcion: datos.descripcion ?? "" }}
        onGuardar={async (nuevos) => {
          const r = await actualizarDatosWorkflow(workflow.id, nuevos);
          if (!r.exito) return r;
          setDatos((d) => ({ ...d, nombre: nuevos.nombre, descripcion: nuevos.descripcion || null }));
          return { exito: true };
        }}
      />
    </div>
  );
}

function BotonIcono({ etiqueta, children, ...props }: { etiqueta: string; children: React.ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={etiqueta} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}

function IndicadorGuardado({ estado }: { estado: EstadoGuardado }) {
  const config = {
    guardado: { icono: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, texto: "Guardado" },
    pendiente: { icono: <Cloud className="h-3.5 w-3.5" />, texto: "Cambios sin guardar" },
    guardando: { icono: <Loader2 className="h-3.5 w-3.5 animate-spin" />, texto: "Guardando…" },
    error: { icono: <CloudOff className="h-3.5 w-3.5 text-danger" />, texto: "No se pudo guardar" },
  }[estado];
  return (
    <span className="mr-1 hidden items-center gap-1 text-[11px] text-muted-foreground md:flex" aria-live="polite">
      {config.icono}
      {config.texto}
    </span>
  );
}
