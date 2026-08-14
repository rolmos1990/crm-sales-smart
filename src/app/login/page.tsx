import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormLogin } from "@/shared/auth/components/form-login";
import { AuthLayout } from "@/shared/auth/components/auth-layout";
import { obtenerSesionActual } from "@/shared/auth/sesion";

export const metadata: Metadata = {
  title: "Iniciar sesión — KariaApp",
};

export default async function LoginPage() {
  const sesion = await obtenerSesionActual();
  if (sesion) redirect("/crm");

  return (
    <AuthLayout>
      <div className="mb-8 space-y-1 text-center lg:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Bienvenido de vuelta
        </h2>
        <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
      </div>

      <Suspense>
        <FormLogin />
      </Suspense>

      <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-lime-600 hover:underline dark:text-lime-400">
          Crea tu empresa
        </Link>
        . Si eres parte de un equipo existente, solicita una invitación al administrador de tu
        instancia.
      </p>
    </AuthLayout>
  );
}
