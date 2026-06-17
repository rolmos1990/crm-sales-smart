import { z } from "zod";

export const CrearUsuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().email("Email inválido"),
  tipo: z.enum(["USUARIO", "AGENTE"]),
  rol: z.enum(["ADMIN", "AGENTE"]),
  cargo: z.string().max(100).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
});

export const EditarUsuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  rol: z.enum(["ADMIN", "AGENTE"]),
  cargo: z.string().max(100).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
});

export type CrearUsuarioInput = z.infer<typeof CrearUsuarioSchema>;
export type EditarUsuarioInput = z.infer<typeof EditarUsuarioSchema>;
