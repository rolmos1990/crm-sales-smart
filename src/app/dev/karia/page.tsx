import { notFound } from "next/navigation";
import { VitrinaKaria } from "@/asistente/components/vitrina-karia";

// Vitrina para probar la mascota a mano y en E2E; no existe en producción.
export default function PaginaVitrinaKaria() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrinaKaria />;
}
