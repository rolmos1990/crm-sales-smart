import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { prisma } from "@/shared/db/prisma";

export const metadata: Metadata = {
  title: "Estado de eliminación de datos — KariaApp",
  description: "Consulta el estado de tu solicitud de eliminación de datos de Karia App.",
};

const EMAIL_CONTACTO = "kariacrmmanager@gmail.com";

interface EventoPayload {
  metaUserId?: string;
  confirmationCode?: string;
  estado?: string;
  issuedAt?: number;
}

async function buscarSolicitud(id: string) {
  return prisma.eventoLog.findFirst({
    where: {
      tipo: "META_SOLICITUD_ELIMINACION_DATOS",
      payload: { path: ["confirmationCode"], equals: id },
    },
    select: { ocurridoEn: true, payload: true },
  });
}

export default async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const solicitud = id ? await buscarSolicitud(id) : null;
  const payload = (solicitud?.payload as EventoPayload) ?? null;

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center sm:px-8">
        <Link
          href="/"
          className="mb-8 text-xs font-semibold uppercase tracking-widest text-lime-600 dark:text-lime-400"
        >
          KariaApp
        </Link>

        {solicitud ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime-500/10 text-lime-600 dark:text-lime-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              Solicitud de eliminación recibida
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Recibimos tu solicitud el{" "}
              {new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(
                solicitud.ocurridoEn,
              )}
              .{" "}
              {payload?.estado === "PROCESADO_AUTOMATICO"
                ? "Tu cuenta de Instagram ya fue desconectada y el token de acceso eliminado automáticamente."
                : "Nuestro equipo revisa y completa cada solicitud en un plazo máximo de 30 días."}
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Código de confirmación: <code className="font-mono">{payload?.confirmationCode ?? id}</code>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              No encontramos esa solicitud
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              El código de confirmación no es válido o ya expiró. Si crees que esto es un error,
              o quieres solicitar directamente la eliminación de tus datos, escríbenos a{" "}
              <a href={`mailto:${EMAIL_CONTACTO}`} className="text-lime-600 hover:underline dark:text-lime-400">
                {EMAIL_CONTACTO}
              </a>
              .
            </p>
          </>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          Ver también nuestra{" "}
          <Link href="/privacy-policy" className="text-lime-600 hover:underline dark:text-lime-400">
            Política de Privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
