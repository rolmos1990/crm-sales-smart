// 012-perfil-dinamico-cliente — vista de solo lectura del perfil calculado
// de un contacto. Objetivo e interpretado quedan visualmente separados
// (Historia 2, FR-002): nunca se mezclan como si fueran el mismo tipo de
// dato.
import { Sparkles, ShieldCheck } from "lucide-react";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

const ETIQUETA_TIPO_RELACION: Record<string, string> = {
  NUEVO_CONTACTO: "Nuevo contacto",
  PROSPECTO_RECURRENTE: "Prospecto recurrente",
  CLIENTE_NUEVO: "Cliente nuevo",
  CLIENTE_REGULAR: "Cliente regular",
  CLIENTE_INACTIVO: "Cliente inactivo",
  CLIENTE_CON_INCIDENCIA: "Cliente con incidencia activa",
};

interface PanelPerfilClienteProps {
  perfil: PerfilCliente | null;
}

export function PanelPerfilCliente({ perfil }: PanelPerfilClienteProps) {
  if (!perfil) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-2xl border border-dashed border-stone-200 dark:border-white/10">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">Perfil no disponible</p>
        <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">No se pudo calcular el perfil de este contacto todavía</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 dark:border-white/8 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Perfil objetivo
          </span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
            {ETIQUETA_TIPO_RELACION[perfil.tipoRelacion] ?? perfil.tipoRelacion}
          </p>
          {perfil.senalesObjetivas.length > 0 ? (
            <ul className="text-sm text-stone-600 dark:text-stone-400 list-disc list-inside space-y-1">
              {perfil.senalesObjetivas.map((senal, i) => (
                <li key={i}>{senal}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-400 dark:text-stone-600">Sin señales objetivas todavía.</p>
          )}
        </div>
      </div>

      {perfil.datosInterpretados && (
        <div className="rounded-2xl border border-purple-200 dark:border-purple-400/20 bg-purple-50/50 dark:bg-purple-400/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-purple-100 dark:border-purple-400/10 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
              Interpretado por IA — no es un hecho confirmado
            </span>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm text-stone-600 dark:text-stone-400">
            {perfil.datosInterpretados.intencionComercialActual && (
              <p>Intención actual: {perfil.datosInterpretados.intencionComercialActual}</p>
            )}
            {perfil.datosInterpretados.presupuestoConocido && (
              <p>Presupuesto mencionado: {perfil.datosInterpretados.presupuestoConocido}</p>
            )}
            {perfil.datosInterpretados.ocasionActual && <p>Ocasión: {perfil.datosInterpretados.ocasionActual}</p>}
            {perfil.datosInterpretados.preferenciasIdentificadas.length > 0 && (
              <p>Preferencias: {perfil.datosInterpretados.preferenciasIdentificadas.join(", ")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
