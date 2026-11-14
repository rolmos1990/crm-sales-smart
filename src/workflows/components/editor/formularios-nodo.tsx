"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ConstructorCondiciones, arbolVacio } from "@/sales/flujo-venta/components/constructor-condiciones";
import type { GroupNode } from "@/sales/flujo-venta/reglas/tipos";
import { TipoDisparadorWorkflow } from "@/generated/prisma/enums";
import { camposCondicion } from "../../definicion/campos-condicion";
import {
  CAMPOS_ACTUALIZABLES,
  MAX_MENSAJES_MEMORIA,
  MENSAJES_MEMORIA_DEFECTO,
  MIN_MENSAJES_MEMORIA,
  type DefinicionWorkflow,
  type Destinatario,
  type Duracion,
  type NodoWorkflow,
} from "../../definicion/schema";
import { VARIABLES_SISTEMA, variablesDeclaradas } from "../../definicion/variables";
import type { OpcionesEditor } from "../../queries";
import { ETIQUETA_DISPARADOR } from "../estilos";
import { Campo, CampoDestinatario, CampoDuracion, SelectSimple, TextoConVariables, type OpcionSelect } from "./campos";
import { generarId } from "./estado-editor";

type Config = Record<string, unknown>;

interface PropsFormulario {
  config: Config;
  onChange: (config: Config) => void;
  opciones: OpcionesEditor;
  definicion: DefinicionWorkflow;
}

// Lectores tolerantes: la config del borrador puede venir incompleta.
const texto = (c: Config, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
const numero = (c: Config, k: string, porDefecto: number) => (typeof c[k] === "number" ? (c[k] as number) : porDefecto);
const lista = <T,>(c: Config, k: string): T[] => (Array.isArray(c[k]) ? (c[k] as T[]) : []);

function useVariables(definicion: DefinicionWorkflow) {
  return useMemo(() => [...VARIABLES_SISTEMA, ...variablesDeclaradas(definicion)], [definicion]);
}

// ── Control ─────────────────────────────────────────────────────────────────

// Eventos que el motor ya inicia (src/workflows/motor/disparo.ts). El resto
// se muestra como "Próximamente" para no prometer algo que no corre.
const DISPARADORES_SOPORTADOS = new Set<string>(["ENTRADA_ETAPA", "MENSAJE_RECIBIDO", "MANUAL"]);

function FormInicio({ config, onChange }: PropsFormulario) {
  const seleccionados = new Set(lista<string>(config, "disparadoresAceptados"));
  const alternar = (d: string, activo: boolean) => {
    const nuevo = new Set(seleccionados);
    if (activo) nuevo.add(d);
    else nuevo.delete(d);
    onChange({ ...config, disparadoresAceptados: [...nuevo] });
  };
  return (
    <Campo
      etiqueta="Eventos que pueden iniciar este Workflow"
      ayuda="Para usarlo en una etapa del pipeline, marca “Entrada a una etapa” y asígnalo desde la configuración del pipeline."
    >
      <div className="space-y-2">
        {Object.values(TipoDisparadorWorkflow).map((d) => {
          const soportado = DISPARADORES_SOPORTADOS.has(d);
          return (
            <label key={d} className={cn("flex items-center gap-2 text-sm", !soportado && "text-muted-foreground")}>
              <Checkbox
                checked={seleccionados.has(d)}
                disabled={!soportado && !seleccionados.has(d)}
                onCheckedChange={(v) => alternar(d, v === true)}
              />
              {ETIQUETA_DISPARADOR[d]}
              {!soportado && <span className="text-[10px] uppercase tracking-wide">Próximamente</span>}
            </label>
          );
        })}
      </div>
    </Campo>
  );
}

const RESULTADOS_FIN: OpcionSelect[] = [
  { valor: "COMPLETADO", etiqueta: "Completado" },
  { valor: "NO_INTERESADO", etiqueta: "Cliente no interesado" },
  { valor: "TRANSFERIDO", etiqueta: "Transferido a humano" },
  { valor: "CONVERTIDO", etiqueta: "Oportunidad convertida" },
  { valor: "CANCELADO", etiqueta: "Cancelado" },
  { valor: "OTRO", etiqueta: "Otro" },
];

function FormFin({ config, onChange }: PropsFormulario) {
  return (
    <>
      <Campo etiqueta="Resultado" ayuda="Queda registrado en el historial de la ejecución.">
        <SelectSimple valor={texto(config, "resultado")} opciones={RESULTADOS_FIN} onChange={(v) => onChange({ ...config, resultado: v })} />
      </Campo>
      <Campo etiqueta="Detalle (opcional)">
        <Input value={texto(config, "etiqueta")} onChange={(e) => onChange({ ...config, etiqueta: e.target.value })} maxLength={80} />
      </Campo>
    </>
  );
}

function FormCondicion({ config, onChange, opciones, definicion }: PropsFormulario) {
  const ramas = lista<{ id: string; etiqueta: string; arbol?: GroupNode }>(config, "ramas");
  const etapas = useMemo(
    () => opciones.pipelines.flatMap((p) => p.stages.map((s) => ({ id: s.id, nombre: s.nombre, pipeline: p.nombre }))),
    [opciones.pipelines],
  );
  const campos = useMemo(() => camposCondicion(definicion, etapas), [definicion, etapas]);
  const actualizar = (nuevas: typeof ramas) => onChange({ ...config, ramas: nuevas });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Las ramas se evalúan en orden: el flujo sigue por la primera que se cumpla. Si ninguna se cumple, sigue por “En otro caso”.
      </p>
      {ramas.map((rama, i) => (
        <div key={rama.id} className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={rama.etiqueta}
              onChange={(e) => actualizar(ramas.map((r) => (r.id === rama.id ? { ...r, etiqueta: e.target.value } : r)))}
              placeholder={`Rama ${i + 1}`}
              className="h-8"
              aria-label="Nombre de la rama"
            />
            {ramas.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Quitar rama"
                onClick={() => actualizar(ramas.filter((r) => r.id !== rama.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <ConstructorCondiciones
            value={rama.arbol ?? arbolVacio()}
            campos={campos}
            onChange={(arbol) => actualizar(ramas.map((r) => (r.id === rama.id ? { ...r, arbol } : r)))}
          />
        </div>
      ))}
      {ramas.length < 10 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => actualizar([...ramas, { id: generarId("r"), etiqueta: `Rama ${ramas.length + 1}`, arbol: arbolVacio() }])}
        >
          <Plus className="h-4 w-4" />
          Agregar rama
        </Button>
      )}
    </div>
  );
}

const ACCIONES_INTERRUPCION: OpcionSelect[] = [
  { valor: "CONTINUAR_ESPERANDO", etiqueta: "Seguir esperando" },
  { valor: "CANCELAR_TIMER", etiqueta: "Terminar la espera y continuar ya" },
  { valor: "CANCELAR_WORKFLOW", etiqueta: "Cancelar el Workflow" },
  { valor: "RUTA_ALTERNATIVA", etiqueta: "Seguir por la salida “Interrumpido”" },
];
const MOTIVOS_INTERRUPCION: { clave: string; etiqueta: string }[] = [
  { clave: "CLIENTE_RESPONDE", etiqueta: "Si el cliente responde" },
  { clave: "CAMBIO_ETAPA", etiqueta: "Si la oportunidad cambia de etapa" },
  { clave: "OPORTUNIDAD_GANADA", etiqueta: "Si la oportunidad se gana" },
  { clave: "HUMANO_TOMA", etiqueta: "Si un agente toma la conversación" },
];

function FormTimer({ config, onChange }: PropsFormulario) {
  const modo = texto(config, "modo") || "DURACION";
  const politicas = (config.politicas as Record<string, string> | undefined) ?? {};
  return (
    <>
      <Campo etiqueta="Tipo de espera">
        <SelectSimple
          valor={modo}
          opciones={[
            { valor: "DURACION", etiqueta: "Esperar un tiempo" },
            { valor: "HASTA_FECHA", etiqueta: "Esperar hasta una fecha y hora" },
          ]}
          onChange={(v) =>
            onChange(
              v === "DURACION"
                ? { modo: v, duracion: { cantidad: 1, unidad: "DIAS" }, politicas }
                : { modo: v, fechaHoraLocal: "", politicas },
            )
          }
        />
      </Campo>
      {modo === "DURACION" ? (
        <Campo etiqueta="Duración" ayuda="Máximo 90 días. La espera no bloquea nada: el sistema retoma el flujo al vencer.">
          <CampoDuracion valor={config.duracion as Duracion | undefined} onChange={(d) => onChange({ ...config, duracion: d })} />
        </Campo>
      ) : (
        <Campo etiqueta="Fecha y hora" ayuda="En la zona horaria configurada para la empresa.">
          <Input
            type="datetime-local"
            value={texto(config, "fechaHoraLocal")}
            onChange={(e) => onChange({ ...config, fechaHoraLocal: e.target.value })}
          />
        </Campo>
      )}
      <Campo etiqueta="Durante la espera" ayuda="Para seguimientos comerciales se recomienda cancelar si el cliente responde o cambia de etapa.">
        <div className="space-y-2">
          {MOTIVOS_INTERRUPCION.map((m) => (
            <div key={m.clave} className="space-y-1">
              <p className="text-xs text-muted-foreground">{m.etiqueta}</p>
              <SelectSimple
                valor={politicas[m.clave] ?? "CONTINUAR_ESPERANDO"}
                opciones={ACCIONES_INTERRUPCION}
                onChange={(v) => {
                  const nuevas = { ...politicas };
                  if (v === "CONTINUAR_ESPERANDO") delete nuevas[m.clave];
                  else nuevas[m.clave] = v;
                  onChange({ ...config, politicas: nuevas });
                }}
              />
            </div>
          ))}
        </div>
      </Campo>
    </>
  );
}

function FormEjecutarWorkflow({ config, onChange, opciones, definicion }: PropsFormulario) {
  const declaradas = variablesDeclaradas(definicion);
  const transferir = new Set(lista<string>(config, "transferirVariables"));
  return (
    <>
      <Campo etiqueta="Workflow a ejecutar" ayuda="Este Workflow termina y el control pasa al elegido. Solo se listan Workflows publicados.">
        {opciones.workflows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay otros Workflows publicados.</p>
        ) : (
          <SelectSimple
            valor={texto(config, "workflowId")}
            opciones={opciones.workflows.map((w) => ({ valor: w.id, etiqueta: w.nombre }))}
            onChange={(v) => onChange({ ...config, workflowId: v })}
          />
        )}
      </Campo>
      {declaradas.length > 0 && (
        <Campo etiqueta="Variables a transferir">
          <div className="space-y-2">
            {declaradas.map((v) => (
              <label key={v.etiqueta} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={transferir.has(v.etiqueta)}
                  onCheckedChange={(activo) => {
                    const nuevo = new Set(transferir);
                    if (activo === true) nuevo.add(v.etiqueta);
                    else nuevo.delete(v.etiqueta);
                    onChange({ ...config, transferirVariables: [...nuevo] });
                  }}
                />
                <code className="text-xs">{v.ruta}</code>
              </label>
            ))}
          </div>
        </Campo>
      )}
    </>
  );
}

// ── Conversación ────────────────────────────────────────────────────────────

const ORIGENES_MENSAJE = [
  { valor: "TEXTO", etiqueta: "Escribir texto" },
  { valor: "PLANTILLA", etiqueta: "Usar plantilla" },
] as const;

function FormEnviarMensaje(props: PropsFormulario) {
  const { config, onChange, opciones } = props;
  const origen = config.origen === "PLANTILLA" ? "PLANTILLA" : "TEXTO";
  const plantilla = opciones.plantillas.find((p) => p.id === config.plantillaId);
  return (
    <>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {ORIGENES_MENSAJE.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange({ ...config, origen: o.valor })}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              origen === o.valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {origen === "TEXTO" ? (
        <MensajeTextoPropio {...props} />
      ) : (
        <Campo
          etiqueta="Plantilla"
          ayuda="Se envía el contenido actual de la plantilla (Configuración → Plantillas), con sus variables reemplazadas. Si editas la plantilla, el Workflow envía la versión nueva."
        >
          {opciones.plantillas.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay plantillas activas. Créalas en Configuración → Plantillas.</p>
          ) : (
            <div className="space-y-2">
              <SelectSimple
                valor={plantilla?.id}
                opciones={opciones.plantillas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
                onChange={(v) => onChange({ ...config, plantillaId: v })}
                placeholder="Selecciona una plantilla…"
              />
              {plantilla && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-2">
                  {plantilla.imagenUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={plantilla.imagenUrl} alt="" className="max-h-32 rounded-md object-cover" />
                  )}
                  <p className="whitespace-pre-wrap text-xs text-foreground">{plantilla.contenidoTexto || "(sin texto)"}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      onChange({
                        ...config,
                        origen: "TEXTO",
                        texto: plantilla.contenidoTexto ?? "",
                        mediaUrl: plantilla.imagenUrl ?? undefined,
                      })
                    }
                  >
                    Personalizar como texto
                  </Button>
                </div>
              )}
            </div>
          )}
        </Campo>
      )}
    </>
  );
}

function MensajeTextoPropio({ config, onChange, definicion }: PropsFormulario) {
  const variables = useVariables(definicion);
  return (
    <>
      <Campo etiqueta="Mensaje" ayuda="Se envía por el canal de la conversación. Si el canal no permite enviarlo (p.ej. fuera de la ventana de Instagram), el envío falla como cualquier mensaje.">
        <TextoConVariables
          valor={texto(config, "texto")}
          onChange={(v) => onChange({ ...config, texto: v })}
          variables={variables}
          filas={5}
          placeholder="Hola {{contacto.nombre}}, gracias por escribirnos…"
        />
      </Campo>
      <Campo etiqueta="URL de imagen o archivo (opcional)">
        <Input value={texto(config, "mediaUrl")} onChange={(e) => onChange({ ...config, mediaUrl: e.target.value || undefined })} placeholder="https://…" />
      </Campo>
    </>
  );
}

function FormMenu({ config, onChange, definicion }: PropsFormulario) {
  const variables = useVariables(definicion);
  const opcionesMenu = lista<{ id: string; etiqueta: string; sinonimos?: string[] }>(config, "opciones");
  const actualizar = (nuevas: typeof opcionesMenu) => onChange({ ...config, opciones: nuevas });
  const conTimeout = !!config.timeout;
  return (
    <>
      <Campo etiqueta="Pregunta">
        <TextoConVariables valor={texto(config, "pregunta")} onChange={(v) => onChange({ ...config, pregunta: v })} variables={variables} filas={3} placeholder="¿Qué deseas hacer?" />
      </Campo>
      <Campo
        etiqueta="Opciones"
        ayuda="Se envían numeradas (1, 2, 3…). El cliente puede responder con el número, el texto o un sinónimo."
      >
        <div className="space-y-2">
          {opcionesMenu.map((o, i) => (
            <div key={o.id} className="space-y-1 rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}.</span>
                <Input
                  value={o.etiqueta}
                  onChange={(e) => actualizar(opcionesMenu.map((x) => (x.id === o.id ? { ...x, etiqueta: e.target.value } : x)))}
                  placeholder="Texto de la opción"
                  className="h-8"
                />
                {opcionesMenu.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Quitar opción" onClick={() => actualizar(opcionesMenu.filter((x) => x.id !== o.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Input
                value={(o.sinonimos ?? []).join(", ")}
                onChange={(e) =>
                  actualizar(
                    opcionesMenu.map((x) =>
                      x.id === o.id ? { ...x, sinonimos: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x,
                    ),
                  )
                }
                placeholder="Sinónimos separados por coma (opcional)"
                className="h-7 text-xs"
              />
            </div>
          ))}
          {opcionesMenu.length < 10 && (
            <Button type="button" variant="outline" size="sm" onClick={() => actualizar([...opcionesMenu, { id: generarId("o"), etiqueta: "", sinonimos: [] }])}>
              <Plus className="h-4 w-4" />
              Agregar opción
            </Button>
          )}
        </div>
      </Campo>
      <Campo etiqueta="Intentos ante una respuesta no válida">
        <Input type="number" min={1} max={5} value={numero(config, "intentos", 2)} onChange={(e) => onChange({ ...config, intentos: Number(e.target.value) })} className="w-24" />
      </Campo>
      <Campo etiqueta="Guardar la opción elegida en (opcional)" ayuda="Nombre de variable, sin espacios.">
        <Input value={texto(config, "guardarEn")} onChange={(e) => onChange({ ...config, guardarEn: e.target.value || undefined })} placeholder="opcion_elegida" />
      </Campo>
      <label className="flex items-center justify-between gap-3 text-sm">
        Tiempo máximo de espera
        <Switch checked={conTimeout} onCheckedChange={(v) => onChange({ ...config, timeout: v ? { cantidad: 1, unidad: "DIAS" } : undefined })} />
      </label>
      {conTimeout && <CampoDuracion valor={config.timeout as Duracion} onChange={(d) => onChange({ ...config, timeout: d })} />}
    </>
  );
}

function FormEsperarRespuesta({ config, onChange }: PropsFormulario) {
  return (
    <>
      <Campo etiqueta="Respuesta esperada">
        <SelectSimple
          valor={texto(config, "tipoEsperado") || "CUALQUIERA"}
          opciones={[
            { valor: "CUALQUIERA", etiqueta: "Cualquier mensaje" },
            { valor: "NUMERO", etiqueta: "Un número" },
            { valor: "EMAIL", etiqueta: "Un email" },
            { valor: "TELEFONO", etiqueta: "Un teléfono" },
          ]}
          onChange={(v) => onChange({ ...config, tipoEsperado: v })}
        />
      </Campo>
      <Campo etiqueta="Guardar la respuesta en" ayuda="Luego la usas como {{workflow.variables.<nombre>}} o en una Condición.">
        <Input value={texto(config, "guardarEn")} onChange={(e) => onChange({ ...config, guardarEn: e.target.value })} placeholder="presupuesto" />
      </Campo>
      <Campo etiqueta="Tiempo máximo de espera" ayuda="Si vence, el flujo sigue por “Sin respuesta”.">
        <CampoDuracion valor={config.timeout as Duracion | undefined} onChange={(d) => onChange({ ...config, timeout: d })} />
      </Campo>
      <Campo etiqueta="Intentos ante una respuesta no válida">
        <Input type="number" min={1} max={5} value={numero(config, "intentos", 1)} onChange={(e) => onChange({ ...config, intentos: Number(e.target.value) })} className="w-24" />
      </Campo>
    </>
  );
}

function FormAsignarHumano({ config, onChange, opciones }: PropsFormulario) {
  return (
    <>
      <Campo etiqueta="Asignar a" ayuda="La conversación pasa a atención humana: ni la IA ni el Workflow vuelven a responder hasta que la devuelvan.">
        <CampoDestinatario valor={config.destinatario as Destinatario | undefined} onChange={(d) => onChange({ ...config, destinatario: d })} usuarios={opciones.usuarios} />
      </Campo>
      <Campo etiqueta="Motivo (opcional)">
        <Input value={texto(config, "motivo")} onChange={(e) => onChange({ ...config, motivo: e.target.value || undefined })} maxLength={200} />
      </Campo>
    </>
  );
}

// ── CRM ─────────────────────────────────────────────────────────────────────

function FormMoverEtapa({ config, onChange, opciones }: PropsFormulario) {
  const pipelineId = texto(config, "pipelineId");
  const pipeline = opciones.pipelines.find((p) => p.id === pipelineId);
  return (
    <>
      <Campo etiqueta="Pipeline">
        <SelectSimple
          valor={pipelineId}
          opciones={opciones.pipelines.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
          onChange={(v) => onChange({ ...config, pipelineId: v, stageId: "" })}
        />
      </Campo>
      <Campo etiqueta="Etapa destino" ayuda="Si la etapa destino tiene su propio Workflow, se iniciará al mover la oportunidad.">
        <SelectSimple
          valor={texto(config, "stageId")}
          opciones={(pipeline?.stages ?? []).map((s) => ({ valor: s.id, etiqueta: s.nombre }))}
          onChange={(v) => onChange({ ...config, stageId: v })}
          placeholder={pipeline ? "Selecciona una etapa…" : "Elige primero un pipeline"}
        />
      </Campo>
      <Campo etiqueta="Después de mover">
        <SelectSimple
          valor={texto(config, "workflowActual") || "FINALIZAR"}
          opciones={[
            { valor: "FINALIZAR", etiqueta: "Terminar este Workflow (recomendado)" },
            { valor: "CONTINUAR", etiqueta: "Seguir con el siguiente paso" },
          ]}
          onChange={(v) => onChange({ ...config, workflowActual: v })}
        />
      </Campo>
      <Campo etiqueta="Motivo (opcional)" ayuda="Queda en el historial de etapas de la oportunidad.">
        <Input value={texto(config, "motivo")} onChange={(e) => onChange({ ...config, motivo: e.target.value || undefined })} maxLength={200} />
      </Campo>
    </>
  );
}

const ETIQUETA_CAMPO: Record<(typeof CAMPOS_ACTUALIZABLES)[number], string> = {
  titulo: "Título",
  notas: "Notas",
  valor: "Valor",
  probabilidad: "Probabilidad (%)",
  responsable: "Responsable",
  agregarEtiqueta: "Agregar etiqueta",
  quitarEtiqueta: "Quitar etiqueta",
};

function FormActualizarOportunidad({ config, onChange, opciones }: PropsFormulario) {
  const cambios = lista<{ campo: string; valor: string }>(config, "cambios");
  const actualizar = (nuevos: typeof cambios) => onChange({ ...config, cambios: nuevos });
  const opcionesCampo = CAMPOS_ACTUALIZABLES.map((c) => ({ valor: c, etiqueta: ETIQUETA_CAMPO[c] }));

  const editorValor = (cambio: { campo: string; valor: string }, i: number) => {
    const set = (valor: string) => actualizar(cambios.map((c, j) => (j === i ? { ...c, valor } : c)));
    if (cambio.campo === "responsable") {
      return <SelectSimple valor={cambio.valor} opciones={opciones.usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))} onChange={set} />;
    }
    if (cambio.campo === "agregarEtiqueta" || cambio.campo === "quitarEtiqueta") {
      return <SelectSimple valor={cambio.valor} opciones={opciones.etiquetas.map((t) => ({ valor: t.id, etiqueta: t.nombre }))} onChange={set} />;
    }
    if (cambio.campo === "notas") return <Textarea rows={2} value={cambio.valor} onChange={(e) => set(e.target.value)} />;
    return (
      <Input
        type={cambio.campo === "valor" || cambio.campo === "probabilidad" ? "number" : "text"}
        value={cambio.valor}
        onChange={(e) => set(e.target.value)}
      />
    );
  };

  return (
    <div className="space-y-3">
      {cambios.map((cambio, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-2">
          <div className="flex items-center gap-2">
            <SelectSimple
              valor={cambio.campo}
              opciones={opcionesCampo}
              onChange={(campo) => actualizar(cambios.map((c, j) => (j === i ? { campo, valor: "" } : c)))}
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Quitar cambio" onClick={() => actualizar(cambios.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {editorValor(cambio, i)}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => actualizar([...cambios, { campo: "notas", valor: "" }])}>
        <Plus className="h-4 w-4" />
        Agregar cambio
      </Button>
    </div>
  );
}

function FormCrearTarea({ config, onChange, opciones, definicion }: PropsFormulario) {
  const variables = useVariables(definicion);
  return (
    <>
      <Campo etiqueta="Título">
        <TextoConVariables valor={texto(config, "titulo")} onChange={(v) => onChange({ ...config, titulo: v })} variables={variables} multilinea={false} placeholder="Llamar a {{contacto.nombre}}" />
      </Campo>
      <Campo etiqueta="Descripción (opcional)">
        <TextoConVariables valor={texto(config, "descripcion")} onChange={(v) => onChange({ ...config, descripcion: v || undefined })} variables={variables} filas={3} />
      </Campo>
      <Campo etiqueta="Responsable">
        <CampoDestinatario valor={config.responsable as Destinatario | undefined} onChange={(d) => onChange({ ...config, responsable: d })} usuarios={opciones.usuarios} />
      </Campo>
      <Campo etiqueta="Vence en">
        <CampoDuracion valor={config.vencimiento as Duracion | undefined} onChange={(d) => onChange({ ...config, vencimiento: d })} />
      </Campo>
      <Campo etiqueta="Prioridad">
        <SelectSimple
          valor={texto(config, "prioridad") || "MEDIA"}
          opciones={[
            { valor: "ALTA", etiqueta: "Alta" },
            { valor: "MEDIA", etiqueta: "Media" },
            { valor: "BAJA", etiqueta: "Baja" },
          ]}
          onChange={(v) => onChange({ ...config, prioridad: v })}
        />
      </Campo>
    </>
  );
}

function FormNotificarAgente({ config, onChange, opciones, definicion }: PropsFormulario) {
  const variables = useVariables(definicion);
  return (
    <>
      <Campo etiqueta="Notificar a">
        <CampoDestinatario valor={config.destinatario as Destinatario | undefined} onChange={(d) => onChange({ ...config, destinatario: d })} usuarios={opciones.usuarios} />
      </Campo>
      <Campo etiqueta="Mensaje">
        <TextoConVariables valor={texto(config, "mensaje")} onChange={(v) => onChange({ ...config, mensaje: v })} variables={variables} filas={3} placeholder="{{contacto.nombre}} lleva 48 horas sin responder la cotización" />
      </Campo>
      <label className="flex items-center justify-between gap-3 text-sm">
        Enviar también por email
        <Switch checked={config.tambienEmail === true} onCheckedChange={(v) => onChange({ ...config, tambienEmail: v })} />
      </label>
    </>
  );
}

// ── IA ──────────────────────────────────────────────────────────────────────

// 031 — memoria conversacional del nodo. Los tres estados de la clave
// `memoria` son significativos y distintos entre sí (ver research D4):
//   ausente          → comportamiento previo a la 031 (presupuesto de tokens)
//   { activa: true } → exactamente `cantidad` mensajes
//   { activa: false} → solo el último mensaje del cliente
// Por eso apagar el switch escribe `{ activa: false }` y NO borra la clave:
// borrarla devolvería el nodo al comportamiento legacy, que no es lo que el
// usuario pidió al apagarlo.
function MemoriaAtencionIA({ config, onChange }: Pick<PropsFormulario, "config" | "onChange">) {
  const memoria = config.memoria as { activa?: boolean; cantidad?: number } | undefined;
  const activa = !!memoria?.activa;
  const cantidad = memoria?.cantidad ?? MENSAJES_MEMORIA_DEFECTO;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        Leer mensajes anteriores
        <Switch
          checked={activa}
          onCheckedChange={(v) => onChange({ ...config, memoria: { activa: v, cantidad } })}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        {activa
          ? "El agente entra a cada turno viendo lo que ya se habló."
          : memoria
            ? "El agente solo ve el último mensaje del cliente."
            : "Sin configurar: la cantidad la decide el límite de contexto del agente."}
      </p>
      {activa && (
        <Campo etiqueta="Cuántos recordar" ayuda="Los últimos mensajes de la conversación, del cliente y del agente.">
          <Input
            type="number"
            min={MIN_MENSAJES_MEMORIA}
            max={MAX_MENSAJES_MEMORIA}
            value={cantidad}
            onChange={(e) =>
              onChange({ ...config, memoria: { activa: true, cantidad: Number(e.target.value) } })
            }
            className="w-24"
          />
        </Campo>
      )}
    </div>
  );
}

function FormAtencionIA({ config, onChange, opciones, definicion }: PropsFormulario) {
  const variables = useVariables(definicion);
  const modo = texto(config, "modo") || "CONTINUA";
  return (
    <>
      <Campo etiqueta="Agente IA">
        {opciones.agentes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay agentes IA configurados. Créalos en Configuración → IA.</p>
        ) : (
          <SelectSimple
            valor={texto(config, "agenteIAConfigId")}
            opciones={opciones.agentes.map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
            onChange={(v) => onChange({ ...config, agenteIAConfigId: v })}
          />
        )}
      </Campo>
      <Campo etiqueta="Modo">
        <SelectSimple
          valor={modo}
          opciones={[
            { valor: "CONTINUA", etiqueta: "Atención continua (hasta cumplir el objetivo)" },
            { valor: "RESPUESTA_UNICA", etiqueta: "Una sola respuesta y continuar" },
          ]}
          onChange={(v) => onChange({ ...config, modo: v })}
        />
      </Campo>
      <Campo etiqueta="Objetivo (opcional)" ayuda="Cuando la IA lo considere cumplido, el flujo sigue por “Objetivo cumplido”.">
        <Input value={texto(config, "objetivo")} onChange={(e) => onChange({ ...config, objetivo: e.target.value || undefined })} placeholder="Calificar el interés y obtener el presupuesto" />
      </Campo>
      <Campo etiqueta="Instrucciones adicionales (opcional)" ayuda="Se suman al prompt del agente; no lo reemplazan.">
        <TextoConVariables valor={texto(config, "instrucciones")} onChange={(v) => onChange({ ...config, instrucciones: v || undefined })} variables={variables} filas={4} />
      </Campo>
      <MemoriaAtencionIA config={config} onChange={onChange} />
      <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
        <span>
          Recordar en qué va la conversación
          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
            El agente ve qué producto se habló, qué precio ya informó y qué dejó preguntado.
          </span>
        </span>
        <Switch
          checked={!!(config.ficha as { activa?: boolean } | undefined)?.activa}
          onCheckedChange={(v) => onChange({ ...config, ficha: { activa: v } })}
        />
      </label>
      {modo === "CONTINUA" && (
        <>
          <Campo etiqueta="Máximo de mensajes de la IA">
            <Input type="number" min={1} max={50} value={numero(config, "maxInteracciones", 10)} onChange={(e) => onChange({ ...config, maxInteracciones: Number(e.target.value) })} className="w-24" />
          </Campo>
          <label className="flex items-center justify-between gap-3 text-sm">
            Terminar si el cliente no responde
            <Switch checked={!!config.inactividad} onCheckedChange={(v) => onChange({ ...config, inactividad: v ? { cantidad: 1, unidad: "DIAS" } : undefined })} />
          </label>
          {!!config.inactividad && <CampoDuracion valor={config.inactividad as Duracion} onChange={(d) => onChange({ ...config, inactividad: d })} />}
        </>
      )}
    </>
  );
}

// ── Despacho ────────────────────────────────────────────────────────────────

const FORMULARIOS: Record<NodoWorkflow["tipo"], (p: PropsFormulario) => React.ReactNode> = {
  INICIO: FormInicio,
  FIN: FormFin,
  CONDICION: FormCondicion,
  TIMER: FormTimer,
  EJECUTAR_WORKFLOW: FormEjecutarWorkflow,
  ENVIAR_MENSAJE: FormEnviarMensaje,
  MENU: FormMenu,
  ESPERAR_RESPUESTA: FormEsperarRespuesta,
  ASIGNAR_HUMANO: FormAsignarHumano,
  MOVER_ETAPA: FormMoverEtapa,
  ACTUALIZAR_OPORTUNIDAD: FormActualizarOportunidad,
  CREAR_TAREA: FormCrearTarea,
  NOTIFICAR_AGENTE: FormNotificarAgente,
  ATENCION_IA: FormAtencionIA,
};

export function FormularioNodo({ nodo, ...props }: { nodo: NodoWorkflow } & PropsFormulario) {
  const Formulario = FORMULARIOS[nodo.tipo];
  return (
    <div className="space-y-4">
      <Formulario {...props} />
    </div>
  );
}
