import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import type { ContextoInterpolacion } from "@/conversaciones/interpolacion";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const conversacion = await prisma.conversacion.findUnique({
    where: { id },
    include: {
      contacto: {
        include: { empresa: true },
      },
      oportunidades: {
        where: { esActiva: true },
        take: 1,
        orderBy: { creadoEn: "desc" },
        include: { oportunidad: true },
      },
    },
  });

  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const { contacto } = conversacion;
  const oportunidad = conversacion.oportunidades[0]?.oportunidad ?? null;

  const contexto: ContextoInterpolacion = {
    contacto: {
      nombre: contacto.nombre,
      apellido: contacto.apellido,
      email: contacto.email,
      telefonoPrincipal: contacto.telefonoPrincipal,
      telefonoSecundario: contacto.telefonoSecundario,
      cargo: contacto.cargo,
      creadoEn: contacto.creadoEn.toISOString(),
      actualizadoEn: contacto.actualizadoEn.toISOString(),
    },
    empresa: contacto.empresa
      ? {
          nombre: contacto.empresa.nombre,
          ruc: contacto.empresa.ruc,
          industria: contacto.empresa.industria,
          sitioWeb: contacto.empresa.sitioWeb,
          telefono: contacto.empresa.telefono,
          email: contacto.empresa.email,
          metadata: (contacto.empresa.metadata as Record<string, unknown>) ?? null,
          creadoEn: contacto.empresa.creadoEn.toISOString(),
          actualizadoEn: contacto.empresa.actualizadoEn.toISOString(),
        }
      : null,
    oportunidad: oportunidad
      ? {
          titulo: oportunidad.titulo,
          descripcion: oportunidad.descripcion,
          etapa: oportunidad.etapa,
          valor: oportunidad.valor.toString(),
          moneda: oportunidad.moneda,
          probabilidad: oportunidad.probabilidad,
          fechaCierre: oportunidad.fechaCierre?.toISOString() ?? null,
          fechaGanada: oportunidad.fechaGanada?.toISOString() ?? null,
          fechaPerdida: oportunidad.fechaPerdida?.toISOString() ?? null,
          motivoPerdida: oportunidad.motivoPerdida,
          creadoEn: oportunidad.creadoEn.toISOString(),
          actualizadoEn: oportunidad.actualizadoEn.toISOString(),
          metadata: (oportunidad.metadata as Record<string, unknown>) ?? null,
        }
      : null,
    agente: null,
    correo_agente: null,
  };

  return NextResponse.json(contexto);
}
