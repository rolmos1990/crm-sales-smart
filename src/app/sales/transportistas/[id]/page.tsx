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

  const [zonas, tarifas, promedio] = await Promise.all([
    listarZonasEntrega(sesion.instanciaId),
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
