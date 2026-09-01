import { z } from "zod";

export const ConfiguracionEmpresaSchema = z.object({
  nombreComercial: z.string().max(200).optional().or(z.literal("")),
  razonSocial: z.string().max(300).optional().or(z.literal("")),
  ruc: z.string().max(20).optional().or(z.literal("")),
  tipoNegocio: z.string().max(100).optional().or(z.literal("")),
  industria: z.string().max(100).optional().or(z.literal("")),
  correoPrincipal: z.string().email("Email inválido").optional().or(z.literal("")),
  telefonoPrincipal: z.string().max(30).optional().or(z.literal("")),
  whatsappPrincipal: z.string().max(30).optional().or(z.literal("")),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  pais: z.string().max(100).optional().or(z.literal("")),
  provincia: z.string().max(100).optional().or(z.literal("")),
  ciudad: z.string().max(100).optional().or(z.literal("")),
  direccion: z.string().max(500).optional().or(z.literal("")),
  zonaHoraria: z.string().max(50),
  monedaPrincipal: z.string().max(10),
  idiomaPrincipal: z.string().max(10),
  formatoFecha: z.string().max(20),
  formatoHora: z.enum(["12h", "24h"]),
});

export type ConfiguracionEmpresaInput = z.infer<typeof ConfiguracionEmpresaSchema>;

// 019-cobertura-geografica-envios — FR-010/FR-011/FR-012
export const ConfiguracionGeograficaSchema = z
  .object({
    modoGeografico: z.enum(["UN_SOLO_PAIS", "MULTIPAIS"]),
    paisOperacionId: z.string().optional().nullable(),
  })
  .refine((datos) => datos.modoGeografico !== "UN_SOLO_PAIS" || !!datos.paisOperacionId, {
    message: "Debes elegir el país de operación en modo 'un solo país'",
    path: ["paisOperacionId"],
  });
export type ConfiguracionGeograficaInput = z.infer<typeof ConfiguracionGeograficaSchema>;
