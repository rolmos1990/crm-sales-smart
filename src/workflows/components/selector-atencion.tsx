"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, ChevronDown, Loader2, Play, UserRound, Workflow } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { cn } from "@/lib/utils";
import { cambiarAtencionAction, obtenerAtencionAction, type AccionAtencion, type EstadoAtencion } from "../atencion-actions";

const ESTADO_EJECUCION: Partial<Record<NonNullable<EstadoAtencion["ejecucion"]>["estado"], string>> = {
  EJECUTANDO: "en curso",
  ESPERANDO_RESPUESTA: "esperando respuesta del cliente",
  ESPERANDO_TIMER: "esperando",
  IA_ACTIVA: "la IA está atendiendo",
  ESPERANDO_ACCION_EXTERNA: "esperando revisión",
};

/**
 * Quién atiende la conversación y cómo cambiarlo (D6). Se usa en el panel de
 * contacto del Inbox y en el chat de la oportunidad.
 */
export function SelectorAtencion({ conversacionId, onCambio, className }: { conversacionId: string; onCambio?: () => void; className?: string }) {
  const queryClient = useQueryClient();
  const [cambiando, startCambio] = useTransition();
  const clave = ["atencion-conversacion", conversacionId];
  const { data: estado, isLoading } = useQuery({
    queryKey: clave,
    queryFn: () => obtenerAtencionAction(conversacionId),
    // Mientras un Workflow atiende, el worker la va moviendo de paso.
    refetchInterval: (q) => (q.state.data?.modo === "WORKFLOW" ? 15_000 : false),
  });

  const cambiar = (accion: AccionAtencion, ok: string) =>
    startCambio(async () => {
      const r = await cambiarAtencionAction(conversacionId, accion);
      if (!r.ok) return void toast.error(r.error);
      toast.success(ok);
      await queryClient.invalidateQueries({ queryKey: clave });
      queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionId] });
      onCambio?.();
    });

  if (isLoading) return <Skeleton className={cn("h-14 w-full rounded-xl", className)} />;
  if (!estado) return null;

  const { modo, ejecucion, pausada } = estado;
  const Icono = modo === "HUMANO" ? UserRound : modo === "WORKFLOW" ? Workflow : Bot;
  const titulo =
    modo === "HUMANO"
      ? `Humano${estado.usuarioNombre ? ` · ${estado.usuarioNombre}` : ""}`
      : modo === "WORKFLOW"
        ? `Workflow${ejecucion ? ` · ${ejecucion.workflow}` : ""}`
        : estado.workflowsHabilitados
          ? "Automático (sin Workflow activo)"
          : "Automático (IA de la etapa)";

  return (
    <div data-slot="selector-atencion" className={cn("rounded-xl border border-card-border bg-card px-3 py-2.5", className)}>
      <div className="flex items-start gap-2">
        <Icono className={cn("mt-0.5 h-4 w-4 shrink-0", modo === "HUMANO" ? "text-warning" : modo === "WORKFLOW" ? "text-stage-lavender-text" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-xs font-medium text-foreground">{titulo}</p>
          {modo === "WORKFLOW" && ejecucion && (
            <p className="text-[11px] text-muted-foreground">
              {ejecucion.paso ? `${ejecucion.paso} · ` : ""}
              {ejecucion.reintento ? "reintento tras error" : ESTADO_EJECUCION[ejecucion.estado] ?? ""}
              {ejecucion.esperaHasta && (
                <>
                  {" "}hasta <FechaHora valor={ejecucion.esperaHasta} modo="fechaHora" />
                </>
              )}
            </p>
          )}
          {modo === "WORKFLOW" && ejecucion?.reintento?.error && (
            <p className="text-[11px] text-destructive" title={ejecucion.reintento.error}>
              Falló {ejecucion.reintento.intento} de 3 intentos: {ejecucion.reintento.error}
            </p>
          )}
          {estado.sugerenciasPendientes > 0 && (
            <Link href="/crm/inbox/pendientes-ia" className="block text-[11px] font-medium text-warning hover:underline">
              {estado.sugerenciasPendientes === 1
                ? "1 respuesta de la IA espera tu aprobación"
                : `${estado.sugerenciasPendientes} respuestas de la IA esperan tu aprobación`}
            </Link>
          )}
          {estado.motivo && <p className="truncate text-[11px] text-muted-foreground" title={estado.motivo}>{estado.motivo}</p>}
          {pausada && modo !== "WORKFLOW" && (
            <p className="text-[11px] text-muted-foreground">
              Workflow en pausa: {pausada.workflow}
              {pausada.paso ? ` (en “${pausada.paso}”)` : ""}
            </p>
          )}
          {estado.desde && (
            <p className="text-[10px] text-muted-foreground">
              Desde <FechaHora valor={estado.desde} modo="relativa" />
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={cambiando}
            aria-label="Cambiar tipo de atención"
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
          >
            {cambiando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Cambiar
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {/* DropdownMenuLabel es Menu.GroupLabel de Base UI: fuera de un
                Menu.Group lanza un error al abrir el menú. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">Atención de la conversación</DropdownMenuLabel>
            {modo !== "HUMANO" && (
              <DropdownMenuItem onClick={() => cambiar({ accion: "HUMANO" }, "Ahora atiendes tú: la automatización no responderá")}>
                <UserRound className="h-4 w-4" />
                Tomar la conversación (humano)
              </DropdownMenuItem>
            )}
            {pausada && modo !== "WORKFLOW" && (
              <DropdownMenuItem onClick={() => cambiar({ accion: "RETOMAR" }, `Se retomó “${pausada.workflow}”`)}>
                <Play className="h-4 w-4" />
                Retomar “{pausada.workflow}”
              </DropdownMenuItem>
            )}
            {estado.workflowsHabilitados && estado.workflows.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Workflow className="h-4 w-4" />
                  Iniciar un Workflow
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                  {estado.workflows.map((w) => (
                    <DropdownMenuItem key={w.id} onClick={() => cambiar({ accion: "INICIAR", workflowId: w.id }, `Se inició “${w.nombre}”`)}>
                      {w.nombre}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            </DropdownMenuGroup>
            {modo !== "AUTOMATICO" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => cambiar({ accion: "AUTOMATICO" }, "La conversación vuelve a atención automática")}>
                  <Bot className="h-4 w-4" />
                  Devolver a automático
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
