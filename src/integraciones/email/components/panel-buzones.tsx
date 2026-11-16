"use client";

import { useState } from "react";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzonParaCliente } from "../tipos";
import { ModalRegistrarBuzon } from "./modal-registrar-buzon";
import { TarjetaBuzon } from "./tarjeta-buzon";

interface PipelineOpcion {
  id: string;
  nombre: string;
  esDefault: boolean;
  stages: { id: string; nombre: string; orden: number }[];
}

interface Props {
  buzones: BuzonParaCliente[];
  pipelines: PipelineOpcion[];
  puedeModificar: boolean;
}

export function PanelBuzones({ buzones, pipelines, puedeModificar }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [buzonEnEdicion, setBuzonEnEdicion] = useState<BuzonParaCliente | null>(null);

  const activos = buzones.filter((b) => b.activa).length;

  function abrirAlta() {
    setBuzonEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(buzon: BuzonParaCliente) {
    setBuzonEnEdicion(buzon);
    setModalAbierto(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Buzones conectados</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {buzones.length === 0
              ? "Sin buzones registrados"
              : `${activos} activo${activos === 1 ? "" : "s"} de ${buzones.length}`}
          </p>
        </div>
        {puedeModificar && buzones.length > 0 && (
          <Button type="button" onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Agregar buzón
          </Button>
        )}
      </div>

      {buzones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-2xl border border-dashed border-border">
          <div className="w-14 h-14 rounded-2xl bg-info/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-info" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Sin buzones registrados</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Conectá la casilla de tu negocio con sus datos IMAP y SMTP. Probamos la conexión antes
              de activarla, así no te enterás de un problema cuando ya perdiste un cliente.
            </p>
          </div>
          {puedeModificar && (
            <Button type="button" variant="outline" className="mt-2" onClick={abrirAlta}>
              <Plus className="h-4 w-4" />
              Conectar primer buzón
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {buzones.map((buzon) => (
            <TarjetaBuzon
              key={buzon.id}
              buzon={buzon}
              puedeModificar={puedeModificar}
              onEditar={abrirEdicion}
            />
          ))}
        </div>
      )}

      {modalAbierto && (
        <ModalRegistrarBuzon
          abierto={modalAbierto}
          onCerrar={() => setModalAbierto(false)}
          buzon={buzonEnEdicion}
          pipelines={pipelines}
        />
      )}
    </div>
  );
}
