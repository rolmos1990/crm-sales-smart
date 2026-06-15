import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const MENSAJE_LOGIN_INVALIDO = "Credenciales inválidas o cuenta temporalmente bloqueada.";
