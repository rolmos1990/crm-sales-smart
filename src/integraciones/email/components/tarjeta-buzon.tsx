"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Mail, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import type { BuzonParaCliente } from "../tipos";
import { cambiarEstadoBuzon, eliminarBuzon } from "../actions";

interface Props {
  buzon: BuzonParaCliente;
  puedeModificar: boolean;
  onEditar: (buzon: BuzonParaCliente) => void;
}

export function TarjetaBuzon({ buzon, puedeModificar, onEditar }: Props) {
  const [pendiente, iniciarTransicion] = useTransition();
  const [confirmarBaja, setConfirmarBaja] = useState(false);

  const conError = Boolean(buzon.estado.errorCodigo);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 flex items-start gap-3",
        conError ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-info/10 border border-border flex items-center justify-center shrink-0">
        <Mail className="h-4.5 w-4.5 text-info" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{buzon.nombre}</p>
          <EstadoBuzon activa={buzon.activa} conError={conError} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{buzon.direccion}</p>

        <p className="text-[11px] text-muted-foreground mt-1.5">
          {buzon.entrada.servidor}:{buzon.entrada.puerto} · {buzon.salida.servidor}:
          {buzon.salida.puerto}
        </p>

        {conError ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {buzon.estado.errorMensaje}
          </p>
        ) : buzon.estado.ultimaLecturaOkEn ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Última lectura: <FechaHora valor={buzon.estado.ultimaLecturaOkEn} modo="fechaHora" />
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Todavía sin leer</p>
        )}

        {!buzon.recepcion.crearContactosAutomaticamente && (
          <p className="mt-1.5 text-[11px] text-amber-500">
            Los remitentes desconocidos quedan pendientes de aprobación
          </p>
        )}
      </div>

      {puedeModificar && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Editar"
            onClick={() => onEditar(buzon)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={buzon.activa ? "Desactivar" : "Activar"}
            disabled={pendiente}
            onClick={() =>
              iniciarTransicion(async () => {
                await cambiarEstadoBuzon({ id: buzon.id, activa: !buzon.activa });
              })
            }
          >
            <Power className={cn("h-4 w-4", buzon.activa && "text-emerald-500")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Eliminar"
            disabled={pendiente}
            onClick={() => setConfirmarBaja(true)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}

      <AlertDialog open={confirmarBaja} onOpenChange={setConfirmarBaja}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este buzón?</AlertDialogTitle>
            <AlertDialogDescription>
              Karia deja de leer {buzon.direccion} y no vas a poder responder sus conversaciones. Los
              correos ya recibidos se conservan en el inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                iniciarTransicion(async () => {
                  await eliminarBuzon({ id: buzon.id });
                })
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EstadoBuzon({ activa, conError }: { activa: boolean; conError: boolean }) {
  const { texto, clase } = conError
    ? { texto: "Con error", clase: "bg-destructive/15 text-destructive border-destructive/20" }
    : activa
      ? { texto: "Activo", clase: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" }
      : { texto: "Inactivo", clase: "bg-muted text-muted-foreground border-border" };

  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border",
        clase,
      )}
    >
      {texto}
    </span>
  );
}
