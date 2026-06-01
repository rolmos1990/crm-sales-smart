"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle, AlertCircle, Smartphone, RefreshCw } from "lucide-react";
import Image from "next/image";
import { SelectorPipelineStage } from "@/crm/pipeline/components/selector-pipeline-stage";

interface ModalQRProps {
  instanciaId: string;
  onConectado: () => void;
  onCerrar: () => void;
}

type Estado = "formulario" | "iniciando" | "qr" | "conectado" | "error";

export function ModalQR({ instanciaId, onConectado, onCerrar }: ModalQRProps) {
  const [estado, setEstado] = useState<Estado>("formulario");
  const [nombre, setNombre] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageNombre, setSelectedStageNombre] = useState<string | null>(null);
  const [selectedStageColor, setSelectedStageColor] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [telefono, setTelefono] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarEventSource = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  useEffect(() => () => limpiarEventSource(), []);

  const iniciar = async () => {
    if (!nombre.trim()) return;
    setEstado("iniciando");
    setError(null);

    try {
      const res = await fetch("/api/integraciones/whatsapp-lite/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanciaId,
          nombre: nombre.trim(),
          ...(selectedPipelineId ? { pipelineId: selectedPipelineId } : {}),
          ...(selectedStageId ? { stageId: selectedStageId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error iniciando sesión");

      setSessionId(data.sessionId);

      timeoutRef.current = setTimeout(() => {
        if (timeoutRef.current) {
          setError("Tiempo de espera agotado. Verifica tu conexión e inténtalo de nuevo.");
          setEstado("error");
          limpiarEventSource();
        }
      }, 35_000);

      const es = new EventSource(`/api/integraciones/whatsapp-lite/qr?sessionId=${data.sessionId}`);
      eventSourceRef.current = es;

      es.addEventListener("qr", (e) => {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        const { qr } = JSON.parse(e.data);
        setQrDataUrl(qr);
        setEstado("qr");
      });

      es.addEventListener("conectado", (e) => {
        const { telefono: tel } = JSON.parse(e.data);
        setTelefono(tel);
        setEstado("conectado");
        limpiarEventSource();
        setTimeout(() => { onConectado(); }, 1500);
      });

      es.addEventListener("error", (e) => {
        const msg = e instanceof MessageEvent ? JSON.parse(e.data)?.error : "Error de conexión";
        setError(msg);
        setEstado("error");
        limpiarEventSource();
      });
    } catch (e: any) {
      setError(e.message ?? "Error inesperado");
      setEstado("error");
    }
  };

  const reintentar = () => {
    limpiarEventSource();
    setEstado("formulario");
    setQrDataUrl(null);
    setError(null);
    setSessionId(null);
  };

  const cerrar = async () => {
    if (sessionId) {
      fetch("/api/integraciones/whatsapp-lite/sesion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    limpiarEventSource();
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-stone-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-green-400" />
            </div>
            <span className="text-sm font-semibold text-stone-100">Conectar WhatsApp</span>
          </div>
          <button type="button" onClick={cerrar} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* ── Formulario: nombre + etapa ─────────────── */}
          {estado === "formulario" && (
            <div className="space-y-4">
              <p className="text-sm text-stone-400">
                Dale un nombre a este número para identificarlo en las conversaciones.
              </p>
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1.5">
                  Nombre del número
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && iniciar()}
                  placeholder="Ej: WhatsApp Principal, Ventas, Soporte..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-stone-100 placeholder:text-stone-600 outline-none focus:border-lime-500/40 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1.5">
                  Etapa de entrada <span className="text-stone-600">(opcional)</span>
                </label>
                <SelectorPipelineStage
                  pipelineId={selectedPipelineId}
                  stageId={selectedStageId}
                  stageNombre={selectedStageNombre}
                  stageColor={selectedStageColor}
                  onSelect={(stageId, pipelineId, nombre, color) => {
                    setSelectedPipelineId(pipelineId);
                    setSelectedStageId(stageId);
                    setSelectedStageNombre(nombre);
                    setSelectedStageColor(color);
                  }}
                />
              </div>

              <button
                type="button"
                onClick={iniciar}
                disabled={!nombre.trim()}
                className="w-full py-2.5 rounded-xl bg-green-500/90 text-white text-sm font-semibold hover:bg-green-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generar código QR
              </button>
            </div>
          )}

          {/* ── Iniciando sesión ────────────────────────── */}
          {estado === "iniciando" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
              <p className="text-sm text-stone-400">Iniciando sesión de WhatsApp…</p>
            </div>
          )}

          {/* ── QR code ─────────────────────────────────── */}
          {estado === "qr" && qrDataUrl && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-lg">
                  <Image src={qrDataUrl} alt="QR WhatsApp" width={240} height={240} className="rounded-lg" unoptimized />
                </div>
                <p className="text-xs text-stone-500 text-center leading-relaxed">
                  Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo<br />y escanea este código QR
                </p>
                <div className="flex items-center gap-1.5 text-xs text-stone-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Esperando escaneo…
                </div>
              </div>
            </div>
          )}

          {/* ── QR aún cargando ─────────────────────────── */}
          {estado === "qr" && !qrDataUrl && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
              <p className="text-sm text-stone-400">Generando código QR…</p>
            </div>
          )}

          {/* ── Conectado ───────────────────────────────── */}
          {estado === "conectado" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="h-10 w-10 text-green-400" />
              <p className="text-base font-semibold text-stone-100">¡Conectado!</p>
              <p className="text-sm text-stone-400">{telefono}</p>
            </div>
          )}

          {/* ── Error ───────────────────────────────────── */}
          {estado === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-300 text-center">{error ?? "Error al conectar"}</p>
              </div>
              <button
                type="button"
                onClick={reintentar}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-stone-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
