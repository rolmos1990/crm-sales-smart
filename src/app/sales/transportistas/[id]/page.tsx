import { notFound, redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso, puedeModificar, puedeVerModulo } from "@/shared/auth/permisos";
import { obtenerTransportista } from "@/sales/transportistas/queries";
import { listarZonasEntrega } from "@/sales/transportistas/zonas/queries";
import { listarTarifas, obtenerPromedioTarifas } from "@/sales/transportistas/tarifas/queries";
import { PanelTransportista } from "@/sales/transportistas/components/panel-transportista";

export const dynamic = "force-dynamic";

export default async function TransportistaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "transportistas", "ver").permitido) redirect("/acceso-denegado");

  const transportista = await obtenerTransportista(id, sesion.instanciaId);
  if (!transportista) notFound();

  // 023-transportistas-por-pais — el catálogo de zonas se filtra al país del
  // transportista (research.md Decisión 1); con "país pendiente" no se
  // filtra (la UI deshabilita agregar zonas/tarifas en ese estado igual).
  const [zonas, tarifas, promedio] = await Promise.all([
    listarZonasEntrega(sesion.instanciaId, undefined, transportista.paisId ?? undefined),
    listarTarifas(id),
    obtenerPromedioTarifas(id),
  ]);

  const puedeVerCostos = puedeVerModulo(sesion.rol, "transportistas-costos");

  return (
    <PanelTransportista
      transportista={transportista}
      servicios={transportista.servicios}
      condiciones={transportista.condiciones}
      zonas={zonas.map((z) => ({ id: z.id, nombre: z.nombre }))}
      tarifas={tarifas.map((t) => ({
        id: t.id,
        zonaEntrega: t.zonaEntrega,
        ubicacion: formatearUbicacion(t.zonaEntrega.ubicaciones),
        servicioTransportista: t.servicioTransportista,
        costoInterno: t.costoInterno,
        precioCliente: t.precioCliente,
        margen: t.margen,
        tiempoMinimoDias: t.tiempoMinimoDias,
        tiempoMaximoDias: t.tiempoMaximoDias,
        activa: t.activa,
        usada: t.usada,
      }))}
      promedio={promedio}
      puedeVerCostos={puedeVerCostos}
      puedeModificar={puedeModificar(sesion.rol, "transportistas")}
    />
  );
}

// 023-transportistas-por-pais (FR-007) — etiqueta legible de la provincia/
// estado real de catálogo para cada ubicación de una zona, ej. "🇵🇦 Panamá —
// Panamá Centro"; varias ubicaciones se listan separadas por coma.
function formatearUbicacion(
  ubicaciones: { provinciaEstado: string | null; pais: { nombre: string; banderaEmoji: string | null } }[],
) {
  if (ubicaciones.length === 0) return "—";
  return ubicaciones
    .map((u) => {
      const pais = `${u.pais.banderaEmoji ? `${u.pais.banderaEmoji} ` : ""}${u.pais.nombre}`;
      return u.provinciaEstado ? `${pais} — ${u.provinciaEstado}` : pais;
    })
    .join(", ");
}
