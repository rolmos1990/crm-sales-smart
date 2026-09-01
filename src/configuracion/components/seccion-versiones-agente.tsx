"use client";

// 009-perfil-agente-estructurado-versionado (Historia 2) — historial de
// versiones de un agente: publicar el borrador pendiente, duplicar o
// restaurar cualquier versión ya publicada. Publicar nunca sobrescribe ni
// elimina una versión anterior — siempre crea una nueva.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileEdit, Loader2, RotateCcw, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listarVersionesAgenteIA,
  publicarVersionAgenteIA,
  duplicarVersionAgenteIA,
  restaurarVersionAgenteIA,
} from "@/configuracion/ia/agente-actions";

type Version = Awaited<ReturnType<typeof listarVersionesAgenteIA>>[number];

interface SeccionVersionesAgenteProps {
  agenteIAConfigId: string;
}

export function SeccionVersionesAgente({ agenteIAConfigId }: SeccionVersionesAgenteProps) {
  const [versiones, setVersiones] = useState<Version[] | null>(null);
  const [advertenciasPendientes, setAdvertenciasPendientes] = useState<string[] | null>(null);
  const [isPendingAccion, startAccion] = useTransition();

  async function recargar() {
    const lista = await listarVersionesAgenteIA(agenteIAConfigId);
    setVersiones(lista);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteIAConfigId]);

  function handlePublicar(forzar: boolean) {
    startAccion(async () => {
      const resultado = await publicarVersionAgenteIA(agenteIAConfigId, { forzar });
      if (!resultado.exito) {
        if (resultado.advertencias && resultado.advertencias.length > 0) {
          setAdvertenciasPendientes(resultado.advertencias);
          return;
        }
        toast.error(resultado.error ?? "Error al publicar");
        return;
      }
      setAdvertenciasPendientes(null);
      toast.success(`Versión ${resultado.numero} publicada`);
      recargar();
    });
  }

  function handleDuplicar(versionId: string) {
    startAccion(async () => {
      const resultado = await duplicarVersionAgenteIA(versionId);
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al duplicar");
        return;
      }
      toast.success("Se creó un nuevo borrador a partir de esta versión");
      recargar();
    });
  }

  function handleRestaurar(versionId: string) {
    startAccion(async () => {
      const resultado = await restaurarVersionAgenteIA(versionId);
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al restaurar");
        return;
      }
      toast.success(`Versión ${resultado.numero} publicada a partir de la restauración`);
      recargar();
    });
  }

  if (versiones === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  const borrador = versiones.find((v) => v.estado === "BORRADOR");
  const publicadas = versiones.filter((v) => v.estado === "PUBLICADA");

  return (
    <div className="flex flex-col gap-4">
      {advertenciasPendientes && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-amber-200 text-sm font-medium">
                El borrador tiene posibles contradicciones
              </p>
              <ul className="text-amber-200/80 text-xs space-y-1 list-disc list-inside">
                {advertenciasPendientes.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdvertenciasPendientes(null)}
              className="border-white/10 text-stone-300 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPendingAccion}
              onClick={() => handlePublicar(true)}
              className="bg-amber-500/90 text-stone-950 hover:bg-amber-400 font-semibold"
            >
              Publicar igual
            </Button>
          </div>
        </div>
      )}

      {borrador && (
        <div className="rounded-xl border border-lime-500/25 bg-lime-500/5 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-lime-400/10 p-2">
              <FileEdit className="h-4 w-4 text-lime-400" />
            </div>
            <div>
              <p className="text-stone-200 text-sm font-medium">Borrador sin publicar</p>
              <p className="text-stone-500 text-xs">
                Los cambios no aplican todavía — el agente sigue usando la última versión publicada.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isPendingAccion}
            onClick={() => handlePublicar(false)}
            className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold flex-shrink-0"
          >
            {isPendingAccion ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
          </Button>
        </div>
      )}

      {publicadas.length === 0 ? (
        <p className="text-stone-500 text-sm text-center py-6">
          Todavía no hay ninguna versión publicada.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {publicadas.map((version, indice) => {
            const esVigente = indice === 0; // ordenado por numero desc — la primera PUBLICADA es la vigente
            return (
              <li
                key={version.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  esVigente ? "border-white/15 bg-white/5" : "border-white/8 bg-white/3",
                )}
              >
                <div>
                  <p className="text-stone-200 text-sm font-medium">
                    Versión {version.numero}
                    {esVigente && <span className="ml-2 text-lime-400 text-xs">vigente</span>}
                  </p>
                  <p className="text-stone-500 text-xs">
                    Publicada {version.publicadaEn ? new Date(version.publicadaEn).toLocaleString() : "—"}
                    {version.creadoPor ? ` por ${version.creadoPor}` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPendingAccion}
                    onClick={() => handleDuplicar(version.id)}
                    className="border-white/10 text-stone-300 hover:bg-white/10"
                    title="Duplicar como nuevo borrador"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {!esVigente && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPendingAccion}
                      onClick={() => handleRestaurar(version.id)}
                      className="border-white/10 text-stone-300 hover:bg-white/10"
                      title="Restaurar esta versión"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
