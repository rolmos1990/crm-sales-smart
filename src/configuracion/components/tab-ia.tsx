import { Brain, TrendingUp, Zap } from "lucide-react";
import { obtenerConfigIA, obtenerProveedoresIA, obtenerResumenUsoIA } from "@/configuracion/ia/queries";
import { FormConfiguracionIA } from "./form-configuracion-ia";
import { ListaProveedoresIA } from "./lista-proveedores-ia";

interface TabIAProps {
  instanciaId: string;
}

export async function TabIA({ instanciaId }: TabIAProps) {
  const [config, proveedores, uso] = await Promise.all([
    obtenerConfigIA(instanciaId),
    obtenerProveedoresIA(instanciaId),
    obtenerResumenUsoIA(instanciaId),
  ]);

  const configParaForm = config
    ? {
        habilitado: config.habilitado,
        proveedorDefault: config.proveedorDefault ?? undefined,
        modeloDefault: config.modeloDefault ?? undefined,
        temperaturaDefault: config.temperaturaDefault ?? undefined,
        limiteTokensDiarios: config.limiteTokensDiarios ?? null,
        limiteTokensMensual: config.limiteTokensMensual ?? null,
        fallbackHabilitado: config.fallbackHabilitado,
      }
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-stone-50 tracking-tight">Inteligencia Artificial</h2>
        <p className="text-sm text-stone-400 mt-0.5">
          Configura los proveedores de IA y los parámetros globales del sistema.
        </p>
      </div>

      {/* Métricas de uso */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/8 bg-white/5 p-4 flex items-start gap-3">
          <div className="rounded-lg bg-lime-400/10 p-2">
            <Zap className="h-4 w-4 text-lime-400" />
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Hoy</p>
            <p className="text-xl font-semibold text-stone-50 mt-0.5">{uso.hoy.llamadas.toLocaleString()}</p>
            <p className="text-xs text-stone-400">{uso.hoy.tokens.toLocaleString()} tokens</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/5 p-4 flex items-start gap-3">
          <div className="rounded-lg bg-emerald-400/10 p-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Este mes</p>
            <p className="text-xl font-semibold text-stone-50 mt-0.5">{uso.mes.llamadas.toLocaleString()}</p>
            <p className="text-xs text-stone-400">{uso.mes.tokens.toLocaleString()} tokens</p>
          </div>
        </div>
      </div>

      {/* Configuración general */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-stone-400" />
          <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">
            Configuración general
          </h3>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-5">
          <FormConfiguracionIA inicial={configParaForm} />
        </div>
      </section>

      {/* Proveedores */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-stone-400" />
          <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">
            Proveedores
          </h3>
        </div>
        <ListaProveedoresIA proveedores={proveedores} />
      </section>
    </div>
  );
}
