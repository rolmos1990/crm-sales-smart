import { z } from "zod";

export const ROLES_ASIGNABLES = ["ADMIN", "GERENTE_VENTAS", "SUPERVISOR", "AGENTE_VENTAS", "EJECUTIVO_VENTAS", "AGENTE_SOPORTE", "INVITADO"] as const;

export const CrearUsuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().email("Email inválido"),
  tipo: z.enum(["USUARIO", "AGENTE"]),
  rol: z.enum([...ROLES_ASIGNABLES, "AGENTE"]),
  cargo: z.string().max(100).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
});

export const EditarUsuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  rol: z.enum(ROLES_ASIGNABLES),
  cargo: z.string().max(100).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
});

export type CrearUsuarioInput = z.infer<typeof CrearUsuarioSchema>;
export type EditarUsuarioInput = z.infer<typeof EditarUsuarioSchema>;
