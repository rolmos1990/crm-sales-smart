"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { ConfiguracionEmpresaSchema } from "./schema";
import type { ResultadoAccion, ConfigEmpresa } from "./types";

export async function guardarConfiguracionEmpresa(
  instanciaId: string,
  datos: unknown
): Promise<ResultadoAccion<ConfigEmpresa>> {
  const validado = ConfiguracionEmpresaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  try {
    const config = await prisma.configuracionEmpresa.upsert({
      where: { instanciaId },
      create: {
        instanciaId,
        ...validado.data,
        nombreEmpresa: validado.data.nombreEmpresa || null,
        nombreComercial: validado.data.nombreComercial || null,
        razonSocial: validado.data.razonSocial || null,
        ruc: validado.data.ruc || null,
        tipoNegocio: validado.data.tipoNegocio || null,
        industria: validado.data.industria || null,
        correoPrincipal: validado.data.correoPrincipal || null,
        telefonoPrincipal: validado.data.telefonoPrincipal || null,
        whatsappPrincipal: validado.data.whatsappPrincipal || null,
        sitioWeb: validado.data.sitioWeb || null,
        pais: validado.data.pais || null,
        provincia: validado.data.provincia || null,
        ciudad: validado.data.ciudad || null,
        direccion: validado.data.direccion || null,
      },
      update: {
        ...validado.data,
        nombreEmpresa: validado.data.nombreEmpresa || null,
        nombreComercial: validado.data.nombreComercial || null,
        razonSocial: validado.data.razonSocial || null,
        ruc: validado.data.ruc || null,
        tipoNegocio: validado.data.tipoNegocio || null,
        industria: validado.data.industria || null,
        correoPrincipal: validado.data.correoPrincipal || null,
        telefonoPrincipal: validado.data.telefonoPrincipal || null,
        whatsappPrincipal: validado.data.whatsappPrincipal || null,
        sitioWeb: validado.data.sitioWeb || null,
        pais: validado.data.pais || null,
        provincia: validado.data.provincia || null,
        ciudad: validado.data.ciudad || null,
        direccion: validado.data.direccion || null,
      },
    });

    revalidatePath("/configuracion");
    return { exito: true, datos: config as ConfigEmpresa };
  } catch {
    return { exito: false, error: "Error al guardar la configuración" };
  }
}
