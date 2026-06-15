import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FormRegistro } from "@/shared/auth/components/form-registro";
import { AuthLayout } from "@/shared/auth/components/auth-layout";

export const metadata: Metadata = {
  title: "Crea tu cuenta — Vento",
};

export default function RegistroPage() {
  return (
    <AuthLayout>
      <div className="mb-8 space-y-1 text-center lg:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Crea tu cuenta
        </h2>
        <p className="text-sm text-muted-foreground">Configura tu empresa en minutos</p>
      </div>

      <Suspense>
        <FormRegistro />
      </Suspense>

      <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-lime-600 hover:underline dark:text-lime-400">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
