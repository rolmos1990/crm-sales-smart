"use client";

// 018-simulador-agente (Historia 1, 2) — probar una conversación simulada
// de punta a punta sin efectos reales, con diagnóstico completo, y poder
// cambiar el cliente simulado y reejecutar el último mensaje.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Play, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ejecutarSimulacionAction } from "@/ai/simulador/actions";
import type { DiagnosticoRespuestaSimulada, TipoRelacionCliente, IntencionComercial } from "@/ai/simulador/tipos";

const TIPOS_RELACION: Record<TipoRelacionCliente, string> = {
  NUEVO_CONTACTO: "Nuevo contacto",
  PROSPECTO_RECURRENTE: "Prospecto recurrente",
  CLIENTE_NUEVO: "Cliente nuevo",
  CLIENTE_REGULAR: "Cliente regular",
  CLIENTE_INACTIVO: "Cliente inactivo",
  CLIENTE_CON_INCIDENCIA: "Cliente con incidencia",
};

const INTENCIONES: Record<IntencionComercial, string> = {
  EXPLORANDO: "Explorando",
  COMPARANDO: "Comparando",
  SOLICITANDO_RECOMENDACION: "Solicitando recomendación",
  CONSULTANDO_PRECIO: "Consultando precio",
  CONSULTANDO_DISPONIBILIDAD: "Consultando disponibilidad",
  LISTO_PARA_COTIZAR: "Listo para cotizar",
  LISTO_PARA_COMPRAR: "Listo para comprar",
  ESPERANDO_INFORMACION: "Esperando información",
  REQUIERE_SEGUIMIENTO: "Requiere seguimiento",
  REQUIERE_ATENCION_HUMANA: "Requiere atención humana",
};

export function DiagnosticoCard({ diagnostico }: { diagnostico: DiagnosticoRespuestaSimulada }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex flex-col gap-3 text-sm">
      <div className="rounded-lg bg-white/5 px-3 py-2">
        <p className="text-stone-500 text-xs mb-1">Respuesta del agente</p>
        <p className="text-stone-100 whitespace-pre-wrap">{diagnostico.respuesta}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-stone-500">Estrategia seleccionada</p>
          <p className="text-stone-300">{diagnostico.estrategiaSeleccionada ? diagnostico.estrategiaSeleccionada.nombre : "Ninguna"}</p>
        </div>
        <div>
          <p className="text-stone-500">Ejemplos recuperados</p>
          <p className="text-stone-300">{diagnostico.ejemplosRecuperados.length}</p>
        </div>
        <div>
          <p className="text-stone-500">Nivel de confianza</p>
          <p className="text-stone-300">{diagnostico.nivelConfianza !== null ? diagnostico.nivelConfianza.toFixed(2) : "—"}</p>
        </div>
        <div>
          <p className="text-stone-500">Decisión de autonomía</p>
          <p className="text-stone-300">{diagnostico.decisionAutonomia ? diagnostico.decisionAutonomia.accion : "Sin gate configurado"}</p>
        </div>
      </div>

      {diagnostico.herramientasEjecutadas.length > 0 && (
        <div className="text-xs">
          <p className="text-stone-500 mb-1">Herramientas ejecutadas</p>
          <ul className="flex flex-col gap-1">
            {diagnostico.herramientasEjecutadas.map((h, i) => (
              <li key={i} className="text-stone-300">
                {h.nombre}{h.previsualizado ? " (previsualizado, sin escribir datos reales)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnostico.reglasAplicadas.length > 0 && (
        <div className="text-xs">
          <p className="text-stone-500 mb-1">Reglas aplicadas</p>
          <ul className="flex flex-col gap-0.5">
            {diagnostico.reglasAplicadas.map((r, i) => (
              <li key={i} className="text-stone-400">- {r}</li>
            ))}
          </ul>
        </div>
      )}

      {diagnostico.informacionFaltante.length > 0 && (
        <div className="text-xs rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          <p className="text-amber-400 mb-1">Información faltante</p>
          <ul className="flex flex-col gap-0.5">
            {diagnostico.informacionFaltante.map((f, i) => (
              <li key={i} className="text-amber-300/90">- {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface PanelSimuladorProps {
  agenteIAConfigId: string;
}

export function PanelSimulador({ agenteIAConfigId }: PanelSimuladorProps) {
  const [tipoRelacion, setTipoRelacion] = useState<TipoRelacionCliente>("CLIENTE_NUEVO");
  const [intencion, setIntencion] = useState<IntencionComercial>("EXPLORANDO");
  const [mensajePrueba, setMensajePrueba] = useState("");
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoRespuestaSimulada[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function ejecutar() {
    if (!mensajePrueba.trim()) return;
    startTransition(async () => {
      const resultado = await ejecutarSimulacionAction({
        agenteIAConfigId,
        cliente: { tipoRelacion, intencion },
        usarBorrador: false,
        mensajes: [mensajePrueba.trim()],
      });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      setDiagnosticos(resultado.diagnosticos);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-500 text-xs">
        Simula una conversación de prueba — ninguna acción real se ejecuta (no se crean cotizaciones, pedidos, ni se envían mensajes).
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs">Tipo de cliente simulado</label>
          <Select items={TIPOS_RELACION} value={tipoRelacion} onValueChange={(v) => v && setTipoRelacion(v as TipoRelacionCliente)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPOS_RELACION) as TipoRelacionCliente[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPOS_RELACION[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs">Intención comercial simulada</label>
          <Select items={INTENCIONES} value={intencion} onValueChange={(v) => v && setIntencion(v as IntencionComercial)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(INTENCIONES) as IntencionComercial[]).map((i) => (
                <SelectItem key={i} value={i}>{INTENCIONES[i]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Textarea
        value={mensajePrueba}
        onChange={(e) => setMensajePrueba(e.target.value)}
        placeholder="Mensaje de prueba del cliente simulado..."
        rows={3}
        className="bg-white/5 border-white/10 text-stone-50"
      />

      <Button
        type="button"
        onClick={ejecutar}
        disabled={isPending || !mensajePrueba.trim()}
        className="self-end bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {diagnosticos ? "Reejecutar" : "Ejecutar simulación"}
      </Button>

      {diagnosticos && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <RotateCw className="h-3 w-3" />
            Cambiá el tipo de cliente o la intención arriba y volvé a ejecutar para comparar (Historia 2).
          </div>
          {diagnosticos.map((d, i) => (
            <DiagnosticoCard key={i} diagnostico={d} />
          ))}
        </div>
      )}
    </div>
  );
}
