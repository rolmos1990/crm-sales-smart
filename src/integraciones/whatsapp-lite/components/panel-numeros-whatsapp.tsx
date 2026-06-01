"use client";

import { useState } from "react";
import { Plus, Smartphone, MessageCircle } from "lucide-react";
import { TarjetaNumero } from "./tarjeta-numero";
import { ModalQR } from "./modal-qr";

interface PanelNumerosWhatsAppProps {
  instanciaId: string;
  cuentas: {
    id: string;
    nombre: string;
    identificador: string;
    activa: boolean;
    pipelineId: string | null;
    stageId: string | null;
    stage: { nombre: string; color: string | null } | null;
  }[];
}

export function PanelNumerosWhatsApp({ instanciaId, cuentas }: PanelNumerosWhatsAppProps) {
  const [mostrarModal, setMostrarModal] = useState(false);

  const handleConectado = () => {
    setMostrarModal(false);
    window.location.reload();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-100">Números conectados</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {cuentas.length === 0
              ? "Sin números registrados"
              : `${cuentas.filter((c) => c.activa).length} activo${cuentas.filter((c) => c.activa).length !== 1 ? "s" : ""} de ${cuentas.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-green-500/90 text-white text-sm font-semibold hover:bg-green-400 transition-all shadow-lg hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          Agregar número
        </button>
      </div>

      {/* Lista de números */}
      {cuentas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-2xl border border-dashed border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-400">Sin números registrados</p>
            <p className="text-xs text-stone-600 mt-1 max-w-xs">
              Conecta un número de WhatsApp escaneando el código QR. Puedes registrar varios números y darle un nombre a cada uno.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-green-500/15 text-green-400 text-sm font-medium hover:bg-green-500/20 border border-green-500/20 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Conectar primer número
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {cuentas.map((cuenta) => (
            <TarjetaNumero key={cuenta.id} cuenta={cuenta} />
          ))}
        </div>
      )}

      {/* Info */}
      {cuentas.length > 0 && (
        <div className="rounded-xl bg-white/3 border border-white/8 px-4 py-3 flex gap-3">
          <MessageCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
          <p className="text-xs text-stone-500 leading-relaxed">
            Los números activos aparecerán en el selector de canal al escribir un mensaje en una conversación. Puedes elegir desde qué número responder cada vez.
          </p>
        </div>
      )}

      {/* Modal QR */}
      {mostrarModal && (
        <ModalQR
          instanciaId={instanciaId}
          onConectado={handleConectado}
          onCerrar={() => setMostrarModal(false)}
        />
      )}
    </div>
  );
}
