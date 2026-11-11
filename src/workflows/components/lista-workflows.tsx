"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Pencil, Plus, Power, PowerOff, Search, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { cn } from "@/lib/utils";
import { cambiarEstadoWorkflow, crearWorkflow, duplicarWorkflow, eliminarWorkflow } from "../actions";
import type { WorkflowResumen } from "../queries";
import { DialogoDatosWorkflow } from "./dialogo-datos-workflow";
import { ESTILO_ESTADO, ETIQUETA_DISPARADOR } from "./estilos";

export function ListaWorkflows({ workflows, puedeModificar }: { workflows: WorkflowResumen[]; puedeModificar: boolean }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [aEliminar, setAEliminar] = useState<WorkflowResumen | null>(null);
  const [accionando, startAccion] = useTransition();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) => w.nombre.toLowerCase().includes(q) || w.descripcion?.toLowerCase().includes(q));
  }, [busqueda, workflows]);

  const ejecutar = (accion: () => Promise<{ exito: boolean; error?: string }>, ok: string) =>
    startAccion(async () => {
      const r = await accion();
      if (!r.exito) toast.error(r.error ?? "No se pudo completar la acción");
      else {
        toast.success(ok);
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar Workflow…"
            className="pl-9"
            aria-label="Buscar Workflow"
          />
        </div>
        {puedeModificar && (
          <Button onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" />
            Nuevo Workflow
          </Button>
        )}
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          Icono={Workflow}
          titulo="Aún no tienes Workflows"
          descripcion="Crea flujos para automatizar mensajes, seguimientos con timers, tareas y cambios de etapa. Puedes asignar un Workflow a cada etapa del pipeline."
          accion={
            puedeModificar ? (
              <Button onClick={() => setCreando(true)}>
                <Plus className="h-4 w-4" />
                Crear el primer Workflow
              </Button>
            ) : undefined
          }
        />
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Ningún Workflow coincide con “{busqueda}”.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm" data-slot="lista-workflows">
          {visibles.map((wf) => {
            const estado = ESTILO_ESTADO[wf.estado];
            return (
              <li key={wf.id} className="flex items-start gap-3 p-4 transition-colors hover:bg-card-hover">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Workflow className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/crm/workflows/${wf.id}`}
                      className="truncate font-medium text-foreground hover:underline underline-offset-4"
                    >
                      {wf.nombre}
                    </Link>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", estado.clase)}>
                      {estado.etiqueta}
                    </span>
                    {wf.versionPublicada && (
                      <span className="text-[11px] text-muted-foreground">v{wf.versionPublicada.numero}</span>
                    )}
                  </div>
                  {wf.descripcion && <p className="line-clamp-2 text-sm text-muted-foreground">{wf.descripcion}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {wf.asignaciones.length === 0 ? (
                      <span>Sin asignar</span>
                    ) : (
                      wf.asignaciones.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5"
                          title={ETIQUETA_DISPARADOR[a.disparador]}
                        >
                          {a.stage ? (
                            <>
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: a.stage.color ?? "var(--muted-foreground)" }}
                              />
                              {a.stage.pipeline.nombre} · {a.stage.nombre}
                            </>
                          ) : (
                            ETIQUETA_DISPARADOR[a.disparador]
                          )}
                        </span>
                      ))
                    )}
                    <span aria-hidden>·</span>
                    <span>
                      Editado <FechaHora valor={wf.actualizadoEn} modo="relativa" />
                    </span>
                  </div>
                </div>

                {puedeModificar && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Acciones de ${wf.nombre}`}
                      disabled={accionando}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/crm/workflows/${wf.id}`)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          startAccion(async () => {
                            const r = await duplicarWorkflow(wf.id);
                            if (!r.exito) return void toast.error(r.error);
                            toast.success("Workflow duplicado");
                            router.push(`/crm/workflows/${r.datos.id}`);
                          })
                        }
                      >
                        <Copy className="h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      {wf.estado === "PUBLICADO" && (
                        <DropdownMenuItem onClick={() => ejecutar(() => cambiarEstadoWorkflow(wf.id, false), "Workflow desactivado")}>
                          <PowerOff className="h-4 w-4" />
                          Desactivar
                        </DropdownMenuItem>
                      )}
                      {wf.estado === "INACTIVO" && (
                        <DropdownMenuItem onClick={() => ejecutar(() => cambiarEstadoWorkflow(wf.id, true), "Workflow activado")}>
                          <Power className="h-4 w-4" />
                          Activar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setAEliminar(wf)}>
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <DialogoDatosWorkflow
        abierto={creando}
        onAbiertoChange={setCreando}
        titulo="Nuevo Workflow"
        descripcion="Empezarás con un Inicio conectado a un Fin. Después agregas los pasos en el editor."
        textoAccion="Crear y editar"
        onGuardar={async (datos) => {
          const r = await crearWorkflow(datos);
          if (!r.exito) return r;
          router.push(`/crm/workflows/${r.datos.id}`);
          return { exito: true };
        }}
      />

      <AlertDialog open={!!aEliminar} onOpenChange={(abierto) => !abierto && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{aEliminar?.nombre}</strong> con todas sus versiones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={accionando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const wf = aEliminar;
                setAEliminar(null);
                if (wf) ejecutar(() => eliminarWorkflow(wf.id), "Workflow eliminado");
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
