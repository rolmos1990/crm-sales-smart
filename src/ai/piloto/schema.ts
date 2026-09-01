import { z } from "zod";
import { ClasificacionPiloto } from "@/generated/prisma/enums";

export const CrearConversacionPilotoSchema = z.object({
  conversacionOrigenId: z.string().min(1),
  clasificacion: z.enum(ClasificacionPiloto),
  explicacion: z.string().min(1),
  intencion: z.string().optional(),
  tipoCliente: z.string().optional(),
  productoId: z.string().optional(),
  playbookEstrategiaId: z.string().optional(),
});
export type CrearConversacionPilotoInput = z.infer<typeof CrearConversacionPilotoSchema>;

export const AsociarRecomendacionAEstrategiaSchema = z.object({
  id: z.string().min(1),
  playbookEstrategiaId: z.string().min(1),
});
