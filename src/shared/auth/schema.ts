import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const MENSAJE_LOGIN_INVALIDO = "Credenciales inválidas o cuenta temporalmente bloqueada.";

export const RegistroSchema = z
  .object({
    nombre: z.string().min(2, "Ingresa tu nombre"),
    empresa: z.string().min(2, "Ingresa el nombre de tu empresa"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmarPassword: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export type RegistroInput = z.infer<typeof RegistroSchema>;

export const MENSAJE_REGISTRO_INVALIDO =
  "No pudimos crear tu cuenta. Verifica los datos o intenta con otro correo.";
