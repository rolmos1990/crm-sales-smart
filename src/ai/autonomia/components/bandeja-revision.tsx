"use client";

// 016-niveles-autonomia-automatizacion (Historia 3) — bandeja de revisión de
// respuestas que el gate de autonomía dejó pendientes (SUGGESTION_ONLY o
// CONDITIONAL_AUTOMATION sin condiciones cumplidas).

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  obtenerRespuestasPendientes,
  enviarRespuestaPendiente,
  editarYEnviarRespuestaPendiente,
  descartarRespuestaPendiente,
} from "@/ai/autonomia/actions";

type Pendiente = Awaited<ReturnType<typeof obtenerRespuestasPendientes>>[number];

export function BandejaRevision() {
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [isPending, startTransition] = useTransition();

  async function recargar() {
    setPendientes(await obtenerRespuestasPendientes());
  }

  useEffect(() => {
    recargar();
  }, []);

  function handleEnviar(id: string) {
    startTransition(async () => {
      const resultado = await enviarRespuestaPendiente(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Respuesta enviada");
      recargar();
    });
  }

  function handleGuardarEdicion(id: string) {
    if (!textoEditado.trim()) return;
    startTransition(async () => {
      const resultado = await editarYEnviarRespuestaPendiente({ id, textoEditado: textoEditado.trim() });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Respuesta editada y enviada");
      setEditandoId(null);
      recargar();
    });
  }

  function handleDescartar(id: string) {
    startTransition(async () => {
      const resultado = await descartarRespuestaPendiente(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Respuesta descartada");
      recargar();
    });
  }

  if (pendientes === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-1.5">
        <p className="text-foreground text-sm font-medium">No hay respuestas pendientes de revisión</p>
        <p className="text-muted-foreground text-xs">
          Las respuestas que el agente genere para categorías configuradas como &ldquo;solo sugerir&rdquo; aparecen acá.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pendientes.map((p) => {
        const editando = editandoId === p.id;
        return (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {p.conversacion.contacto ? `${p.conversacion.contacto.nombre} ${p.conversacion.contacto.apellido}` : "Contacto"}
                </p>
                <p className="text-xs text-muted-foreground">{p.motivoPendiente}</p>
              </div>
              {p.categoriaDetectada && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex-shrink-0">
                  {p.categoriaDetectada}
                </span>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1">Mensaje del cliente</p>
              <p className="text-sm text-foreground">{p.mensajeCliente}</p>
            </div>

            {editando ? (
              <Textarea
                value={textoEditado}
                onChange={(e) => setTextoEditado(e.target.value)}
                rows={4}
                className="text-sm"
              />
            ) : (
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">Respuesta propuesta por el agente</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{p.respuestaPropuesta}</p>
              </div>
            )}

            <div className="flex items-center gap-2 justify-end">
              {editando ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditandoId(null)} disabled={isPending}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={() => handleGuardarEdicion(p.id)} disabled={isPending}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Guardar y enviar
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleDescartar(p.id)} disabled={isPending}>
                    <X className="h-3.5 w-3.5" />
                    Descartar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditandoId(p.id);
                      setTextoEditado(p.respuestaPropuesta);
                    }}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button type="button" size="sm" onClick={() => handleEnviar(p.id)} disabled={isPending}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Enviar
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
