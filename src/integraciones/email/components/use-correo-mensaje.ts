"use client";

import { useQuery } from "@tanstack/react-query";
import type { RespuestaCorreoMensaje } from "@/integraciones/email/vista/respuesta";

export type { RespuestaCorreoMensaje };

/** Menor que la vida del token (15 min): al volver a abrir, las URLs siguen vigentes. */
const VIGENCIA_MS = 10 * 60 * 1000;

async function obtenerCorreoMensaje(mensajeId: string): Promise<RespuestaCorreoMensaje> {
  const res = await fetch(`/api/correo/mensajes/${encodeURIComponent(mensajeId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar el correo");
  return res.json() as Promise<RespuestaCorreoMensaje>;
}

/**
 * Datos de correo de un mensaje (cabeceras, estado del HTML, adjuntos, URLs
 * firmadas de la vista aislada). Se piden al expandir la tarjeta: no se toca
 * la consulta de mensajes que comparten los demás canales (FR-028).
 */
export function useCorreoMensaje(mensajeId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["correo-mensaje", mensajeId],
    queryFn: () => obtenerCorreoMensaje(mensajeId),
    enabled: habilitado,
    staleTime: VIGENCIA_MS,
    gcTime: VIGENCIA_MS,
    retry: 1,
  });
}
