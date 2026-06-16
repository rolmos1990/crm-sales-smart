import { prisma } from "@/shared/db/prisma";

const STAGES_DEFAULT = [
  { nombre: "Prospecto",   orden: 0, probabilidad: 10,  esInicial: true,  esGanado: false, esPerdido: false, color: "#818cf8" },
  { nombre: "Calificado",  orden: 1, probabilidad: 25,  esInicial: false, esGanado: false, esPerdido: false, color: "#22d3ee" },
  { nombre: "Propuesta",   orden: 2, probabilidad: 50,  esInicial: false, esGanado: false, esPerdido: false, color: "#fbbf24" },
  { nombre: "Negociación", orden: 3, probabilidad: 75,  esInicial: false, esGanado: false, esPerdido: false, color: "#f97316" },
  { nombre: "Ganado",      orden: 4, probabilidad: 100, esInicial: false, esGanado: true,  esPerdido: false, color: "#4ade80" },
  { nombre: "Perdido",     orden: 5, probabilidad: 0,   esInicial: false, esGanado: false, esPerdido: true,  color: "#fb7185" },
];

export async function crearPipelineDefault(instanciaId: string): Promise<{ id: string } | null> {
  const existente = await prisma.pipeline.findFirst({ where: { instanciaId, esDefault: true } });
  if (existente) return existente;

  return prisma.pipeline.create({
    data: {
      nombre: "Pipeline de ventas",
      esDefault: true,
      activo: true,
      instanciaId,
      stages: { create: STAGES_DEFAULT },
    },
    select: { id: true },
  });
}
