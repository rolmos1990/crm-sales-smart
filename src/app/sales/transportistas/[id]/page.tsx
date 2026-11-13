import { notFound, redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso, puedeModificar, puedeVerModulo } from "@/shared/auth/permisos";
import { obtenerTransportista } from "@/sales/transportistas/queries";
import { listarZonasEntrega } from "@/sales/transportistas/zonas/queries";
import { listarTarifas, obtenerPromedioTarifas } from "@/sales/transportistas/tarifas/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { PanelTransportista } from "@/sales/transportistas/components/panel-transportista";

export const dynamic = "force-dynamic";

export default async function TransportistaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "transportistas", "ver").permitido) redirect("/acceso-denegado");

  const transportista = await obtenerTransportista(id, sesion.instanciaId);
  if (!transportista) notFound();

  // Las zonas son de este transportista (ver ZonaEntrega.transportistaId).
  // 023-transportistas-por-pais — además se filtran a su país; con "país
  // pendiente" no se filtra (la UI deshabilita agregar zonas/tarifas igual).
  const [zonas, tarifas, promedio, moneda] = await Promise.all([
    listarZonasEntrega(sesion.instanciaId, id, undefined, transportista.paisId ?? undefined),
    listarTarifas(id),
    obtenerPromedioTarifas(id),
    obtenerMonedaPrincipal(sesion.instanciaId),
  ]);

  const puedeVerCostos = puedeVerModulo(sesion.rol, "transportistas-costos");

  return (
    <PanelTransportista
      transportista={transportista}
      servicios={transportista.servicios}
      condiciones={transportista.condiciones}
      // `listarZonasEntrega` ya trae las ubicaciones: se pasan para que el
      // modal de edición abra con los datos cargados, sin un viaje extra.
      zonas={zonas.map((z) => ({
        id: z.id,
        nombre: z.nombre,
        ubicaciones: z.ubicaciones.map((u) => ({
          id: u.id,
          paisId: u.paisId,
          provinciaEstado: u.provinciaEstado ?? "",
          distritoCiudad: u.distritoCiudad ?? "",
        })),
      }))}
      tarifas={tarifas.map((t) => ({
        id: t.id,
        zonaEntrega: t.zonaEntrega,
        cobertura: resumirCobertura(t.zonaEntrega.ubicaciones),
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
      moneda={moneda}
      puedeVerCostos={puedeVerCostos}
      puedeModificar={puedeModificar(sesion.rol, "transportistas")}
    />
  );
}

// 023-transportistas-por-pais (FR-007) — cobertura de una zona como etiquetas
// sueltas, una por ubicación distinta. De cada ubicación se toma el nivel más
// específico que tenga (distrito > provincia > país) y se descartan las
// etiquetas repetidas: una zona con ocho distritos de la misma provincia
// producía antes ocho veces el mismo texto en una sola línea. El descarte es
// solo de presentación — las ubicaciones de la zona quedan intactas, y
// `detalle` conserva la jerarquía completa para el tooltip de cada etiqueta.
function resumirCobertura(
  ubicaciones: {
    provinciaEstado: string | null;
    distritoCiudad: string | null;
    pais: { nombre: string; banderaEmoji: string | null };
  }[],
): { etiqueta: string; detalle: string }[] {
  const porEtiqueta = new Map<string, { etiqueta: string; detalle: string }>();
  for (const u of ubicaciones) {
    const provincia = u.provinciaEstado?.trim() || null;
    const distrito = u.distritoCiudad?.trim() || null;
    const etiqueta = distrito ?? provincia ?? u.pais.nombre;
    const detalle = [
      `${u.pais.banderaEmoji ? `${u.pais.banderaEmoji} ` : ""}${u.pais.nombre}`.trim(),
      provincia,
      distrito,
    ]
      .filter(Boolean)
      .join(" — ");
    const clave = etiqueta.toLocaleLowerCase("es");
    if (!porEtiqueta.has(clave)) porEtiqueta.set(clave, { etiqueta, detalle });
  }
  return [...porEtiqueta.values()];
}
