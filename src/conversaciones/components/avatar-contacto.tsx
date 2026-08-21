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
          "rounded-full object-cover border border-inbox-accent-border shrink-0",
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
          ? "bg-inbox-accent-muted border-inbox-accent-border text-inbox-accent"
          : "bg-muted border-border text-muted-foreground",
        className
      )}
    >
      {iniciales}
    </div>
  );
}
