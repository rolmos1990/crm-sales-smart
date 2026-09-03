import { SeccionMetodosEntrega } from "@/configuracion/entregas/components/seccion-metodos-entrega";
import {
  listarMetodosEntregaConfig,
  listarZonasCobertura,
  listarUbicacionesRetiro,
} from "@/configuracion/entregas/queries";

interface TabEnviosProps {
  instanciaId: string;
}

// Trasladada fuera de "Inteligencia Artificial" (a pedido del usuario): esta
// configuración de delivery propio (métodos, zonas de cobertura, ubicaciones
// de retiro — 015-herramientas-operativas-inventario-envios-acciones) es
// operativa del negocio, no algo que dependa de la IA — la IA solo la
// consume como fuente de datos (obtener_metodos_entrega, calcular_costo_envio
// Fuente 2, obtener_ubicaciones_retiro). "Courier externo" convive acá con
// el módulo de transportistas (src/sales/transportistas/) — no se retira.
export async function TabEnvios({ instanciaId }: TabEnviosProps) {
  const [metodosEntrega, zonasCobertura, ubicacionesRetiro] = await Promise.all([
    listarMetodosEntregaConfig(instanciaId),
    listarZonasCobertura(instanciaId),
    listarUbicacionesRetiro(instanciaId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-stone-50 tracking-tight">Envíos</h2>
        <p className="text-sm text-stone-400 mt-0.5">
          Métodos de entrega propios, zonas de cobertura y ubicaciones de retiro.
        </p>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 p-5">
        <SeccionMetodosEntrega
          metodosIniciales={metodosEntrega.map((m) => ({
            id: m.id,
            metodoEntrega: m.metodoEntrega,
            activo: m.activo,
            costoBase: Number(m.costoBase),
            diasEstimadosMin: m.diasEstimadosMin,
            diasEstimadosMax: m.diasEstimadosMax,
            // 019-cobertura-geografica-envios
            modoCobertura: m.modoCobertura,
            zonas: m.zonas.map((z) => ({
              id: z.id,
              zonaCoberturaId: z.zonaCoberturaId,
              zonaNombre: z.zonaCobertura.nombre,
              cubierta: z.cubierta,
              esExcepcion: z.esExcepcion,
            })),
          }))}
          zonasIniciales={zonasCobertura}
          ubicacionesIniciales={ubicacionesRetiro}
        />
      </div>
    </div>
  );
}
