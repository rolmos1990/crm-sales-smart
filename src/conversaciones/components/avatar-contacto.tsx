"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarContactoProps {
  nombre: string;
  apellido: string;
  avatarUrl?: string | null;
  className?: string;
}

/**
 * Avatar de contacto del Inbox: usa la foto de perfil si existe (ej. la de
 * Instagram, capturada al recibir el primer mensaje vía Graph API — ver
 * obtenerPerfilRemitenteIG en el webhook), y si no hay foto o falla la carga,
 * cae a las iniciales del nombre — nunca queda un espacio vacío.
 */
export function AvatarContacto({ nombre, apellido, avatarUrl, className }: AvatarContactoProps) {
  const [fallo, setFallo] = useState(false);
  const nombreCompleto = `${nombre} ${apellido}`.trim();
  const iniciales = nombreCompleto
    ? `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase()
    : "?";

  if (avatarUrl && !fallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={nombreCompleto || "Contacto"}
        onError={() => setFallo(true)}
        className={cn(
          "rounded-full object-cover border border-lime-500/25 dark:border-lime-400/20 shrink-0",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full border flex items-center justify-center font-semibold shrink-0",
        nombreCompleto
          ? "bg-gradient-to-br from-lime-500/20 to-emerald-500/10 dark:from-lime-500/25 dark:to-emerald-500/15 border-lime-500/25 dark:border-lime-400/20 text-lime-700 dark:text-lime-300"
          : "bg-stone-100 dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-stone-400 dark:text-white/30",
        className
      )}
    >
      {iniciales}
    </div>
  );
}
