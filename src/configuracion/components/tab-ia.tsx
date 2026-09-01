import { Brain, TrendingUp, Zap } from "lucide-react";
import {
  obtenerConfigIA,
  obtenerProveedoresIA,
  obtenerResumenUsoIA,
  obtenerAsignacionesObjetivoIA,
} from "@/configuracion/ia/queries";
import { FormConfiguracionIA } from "./form-configuracion-ia";
import { ListaProveedoresIA } from "./lista-proveedores-ia";
import { SeccionEnrutamiento } from "./seccion-enrutamiento";
import { ListaEstrategias } from "@/ai/estrategia/components/lista-estrategias";
import { listarEstrategias } from "@/ai/estrategia/queries";
import { SeccionMetodosEntrega } from "@/configuracion/entregas/components/seccion-metodos-entrega";
import {
  listarMetodosEntregaConfig,
  listarZonasCobertura,
  listarUbicacionesRetiro,
} from "@/configuracion/entregas/queries";
import { ListaConversacionesPiloto } from "@/ai/piloto/components/lista-conversaciones-piloto";
import { BandejaRecomendaciones } from "@/ai/piloto/components/bandeja-recomendaciones";
import { VistaAuditoria } from "@/ai/autonomia/components/vista-auditoria";

interface TabIAProps {
  instanciaId: string;
}

export async function TabIA({ instanciaId }: TabIAProps) {
  const [config, proveedores, uso, asignacionesObjetivo, estrategias, metodosEntrega, zonasCobertura, ubicacionesRetiro] = await Promise.all([
    obtenerConfigIA(instanciaId),
    obtenerProveedoresIA(instanciaId),
    obtenerResumenUsoIA(instanciaId),
    obtenerAsignacionesObjetivoIA(instanciaId),
    listarEstrategias(instanciaId),
    listarMetodosEntregaConfig(instanciaId),
    listarZonasCobertura(instanciaId),
    listarUbicacionesRetiro(instanciaId),
  ]);

  const proveedoresActivos = proveedores
    .filter((p) => p.activo)
    .map((p) => ({ id: p.id, proveedor: p.proveedor }));

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

      {/* Enrutamiento por objetivo (010-enrutamiento-modelos-ia-por-objetivo) */}
      <section className="flex flex-col gap-4">
        <SeccionEnrutamiento
          asignacionesIniciales={asignacionesObjetivo}
          proveedoresActivos={proveedoresActivos}
        />
      </section>

      {/* Estrategias (011-playbook-estrategia-comercial) */}
      <section className="flex flex-col gap-4">
        <ListaEstrategias estrategiasIniciales={estrategias} />
      </section>

      {/* Métodos de entrega, zonas y retiro (015-herramientas-operativas-inventario-envios-acciones) */}
      <section className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/8 bg-white/3 p-5">
          <SeccionMetodosEntrega
            metodosIniciales={metodosEntrega.map((m) => ({
              id: m.id,
              metodoEntrega: m.metodoEntrega,
              activo: m.activo,
              costoBase: Number(m.costoBase),
              diasEstimadosMin: m.diasEstimadosMin,
              diasEstimadosMax: m.diasEstimadosMax,
            }))}
            zonasIniciales={zonasCobertura}
            ubicacionesIniciales={ubicacionesRetiro}
          />
        </div>
      </section>

      {/* Conversaciones piloto y aprendizaje (014-conversaciones-piloto-ejemplos-relevantes) */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">
          Conversaciones piloto y aprendizaje
        </h3>
        <ListaConversacionesPiloto />
        <BandejaRecomendaciones />
      </section>

      {/* Auditoría de respuestas (017-aprendizaje-supervisado-auditoria) */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">
          Auditoría de respuestas IA
        </h3>
        <VistaAuditoria />
      </section>
    </div>
  );
}
