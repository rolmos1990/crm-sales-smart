"use client";

// 017-aprendizaje-supervisado-auditoria — vista de auditoría: cada
// respuesta generada por el agente (enviada automáticamente o revisada),
// con su traza completa (SC-002) y la posibilidad de evaluarla.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { obtenerRegistrosRespuestaAction, agregarEvaluacion } from "@/ai/autonomia/actions";

type Registro = Awaited<ReturnType<typeof obtenerRegistrosRespuestaAction>>[number];

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ENVIADA_TAL_CUAL: "Enviada tal cual",
  EDITADA_Y_ENVIADA: "Editada y enviada",
  DESCARTADA: "Descartada",
  ENVIADA_AUTOMATICAMENTE: "Enviada automáticamente",
};

function FilaRegistro({ registro, onEvaluado }: { registro: Registro; onEvaluado: () => void }) {
  const [expandido, setExpandido] = useState(false);
  const [comentario, setComentario] = useState("");
  const [isPending, startTransition] = useTransition();

  function evaluar(calificacion: "BUENA" | "NECESITA_MEJORA") {
    startTransition(async () => {
      const resultado = await agregarEvaluacion({ respuestaId: registro.id, calificacion, comentario: comentario.trim() || undefined });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Evaluación registrada");
      setComentario("");
      onEvaluado();
    });
  }

  const herramientas = Array.isArray(registro.herramientasEjecutadas) ? (registro.herramientasEjecutadas as string[]) : [];
  const ejemplos = Array.isArray(registro.ejemplosUtilizadosIds) ? (registro.ejemplosUtilizadosIds as string[]) : [];

  return (
    <li className="rounded-xl border border-white/8 bg-white/3 p-3 flex flex-col gap-2">
      <button type="button" onClick={() => setExpandido((v) => !v)} className="flex items-center justify-between gap-2 text-left">
        <div className="min-w-0">
          <p className="text-stone-200 text-sm truncate">
            {registro.conversacion.contacto ? `${registro.conversacion.contacto.nombre} ${registro.conversacion.contacto.apellido}` : "Sin contacto"}
          </p>
          <p className="text-stone-500 text-xs truncate">{registro.mensajeCliente}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline">{ESTADO_LABEL[registro.estado] ?? registro.estado}</Badge>
          {expandido ? <ChevronUp className="h-3.5 w-3.5 text-stone-500" /> : <ChevronDown className="h-3.5 w-3.5 text-stone-500" />}
        </div>
      </button>

      {expandido && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/5 text-xs text-stone-400">
          <p><span className="text-stone-500">Respuesta propuesta:</span> {registro.respuestaPropuesta}</p>
          {registro.respuestaEditada && <p><span className="text-stone-500">Respuesta final (editada):</span> {registro.respuestaEditada}</p>}
          {registro.categoriaDetectada && <p><span className="text-stone-500">Categoría:</span> {registro.categoriaDetectada}</p>}
          {typeof registro.confianza === "number" && <p><span className="text-stone-500">Confianza:</span> {registro.confianza.toFixed(2)}</p>}
          {registro.motivoTransferencia && <p><span className="text-stone-500">Motivo de transferencia:</span> {registro.motivoTransferencia}</p>}
          {registro.productoIdentificado && <p><span className="text-stone-500">Producto identificado:</span> {registro.productoIdentificado.nombre}</p>}
          {herramientas.length > 0 && <p><span className="text-stone-500">Herramientas ejecutadas:</span> {herramientas.join(", ")}</p>}
          {ejemplos.length > 0 && <p><span className="text-stone-500">Ejemplos usados:</span> {ejemplos.length}</p>}
          {registro.usoIA && (
            <p>
              <span className="text-stone-500">Modelo/proveedor:</span> {registro.usoIA.modelo} · {registro.usoIA.proveedorIA?.proveedor ?? "—"} ·{" "}
              {registro.usoIA.tiempoMs}ms · {registro.usoIA.tokensInput + registro.usoIA.tokensOutput} tokens
            </p>
          )}

          {registro.evaluaciones.length > 0 && (
            <div className="flex flex-col gap-1 pt-1">
              <p className="text-stone-500">Evaluaciones:</p>
              {registro.evaluaciones.map((e) => (
                <p key={e.id} className={e.calificacion === "BUENA" ? "text-emerald-400" : "text-amber-400"}>
                  {e.calificacion === "BUENA" ? "Buena" : "Necesita mejora"}{e.comentario ? ` — ${e.comentario}` : ""}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Textarea value={comentario} onChange={(ev) => setComentario(ev.target.value)} placeholder="Comentario (opcional)" rows={2} className="bg-white/5 border-white/10 text-stone-50 text-xs" />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => evaluar("BUENA")} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}Buena
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => evaluar("NECESITA_MEJORA")} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}Necesita mejora
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function VistaAuditoria() {
  const [registros, setRegistros] = useState<Registro[] | null>(null);

  async function recargar() {
    setRegistros(await obtenerRegistrosRespuestaAction());
  }

  useEffect(() => {
    recargar();
  }, []);

  if (registros === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Auditoría de respuestas ({registros.length})</p>
      {registros.length === 0 ? (
        <p className="text-stone-500 text-sm">Sin registros todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[32rem] overflow-y-auto">
          {registros.slice(0, 100).map((r) => (
            <FilaRegistro key={r.id} registro={r} onEvaluado={recargar} />
          ))}
        </ul>
      )}
    </div>
  );
}
