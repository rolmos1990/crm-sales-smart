"use client";

import dynamic from "next/dynamic";

// Diferido y solo en cliente: la mascota no debe competir con el contenido
// principal de la página (FR-012) ni existir en el HTML del servidor.
const AsistenteKariaFlotante = dynamic(
  () => import("@/asistente/components/asistente-karia-flotante").then((m) => m.AsistenteKariaFlotante),
  { ssr: false },
);

export function AsistenteKariaMontaje() {
  return <AsistenteKariaFlotante />;
}
