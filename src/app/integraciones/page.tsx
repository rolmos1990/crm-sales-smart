import { Puzzle } from "lucide-react";
import { CATALOGO_INTEGRACIONES } from "@/integraciones/catalog";
import { ListaIntegracionesLazy } from "@/integraciones/components/lista-integraciones-lazy";
import type { IntegracionConEstado } from "@/integraciones/types";

export default async function IntegracionesPage() {
  // Intentar cargar integraciones instaladas — puede no haber DB configurada aún
  let instaladas: { id: string; clave: string; estado: string }[] = [];
  try {
    const { obtenerInstanciaActiva, obtenerIntegracionesInstaladas } = await import("@/integraciones/queries");
    const instanciaId = await obtenerInstanciaActiva();
    instaladas = await obtenerIntegracionesInstaladas(instanciaId) as typeof instaladas;
  } catch {
    // DB no disponible o sin instancia activa — se muestra el catálogo vacío igualmente
  }

  const integraciones: IntegracionConEstado[] = CATALOGO_INTEGRACIONES.map((item) => {
    const inst = instaladas.find((i) => i.clave === item.clave);
    return {
      ...item,
      instalada: inst
        ? {
            id:            inst.id,
            clave:         inst.clave,
            estado:        inst.estado as "INSTALADA" | "ACTIVA" | "INACTIVA" | "ERROR",
            configuracion: null,
            creadoEn:      new Date(),
            actualizadoEn: new Date(),
          }
        : null,
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-lime-500/10 dark:bg-lime-400/10 border border-lime-500/20 dark:border-lime-400/20 flex items-center justify-center flex-shrink-0">
          <Puzzle className="h-5 w-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Integraciones
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Conecta tu CRM con las herramientas que ya usa tu equipo. Cada integración se activa de forma independiente y no afecta el rendimiento hasta ser instalada.
          </p>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: "Total disponibles", valor: CATALOGO_INTEGRACIONES.filter((i) => i.disponible).length },
          { label: "Instaladas",        valor: instaladas.length },
          { label: "Activas",           valor: instaladas.filter((i) => i.estado === "ACTIVA").length },
        ].map(({ label, valor }) => (
          <div
            key={label}
            className="rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 flex flex-col gap-0.5"
          >
            <span className="text-2xl font-bold text-stone-900 dark:text-stone-50 tabular-nums">
              {valor}
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Lista lazy — se hidrata en cliente sin bloquear el Server Component */}
      <ListaIntegracionesLazy integraciones={integraciones} />
    </div>
  );
}
