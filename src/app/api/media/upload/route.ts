import { NextRequest, NextResponse } from "next/server";
import { subirMedia } from "@/lib/media";
import type { MediaModulo, CanalOrigen, MediaUploadApiResponse, MediaUploadApiError } from "@/lib/media";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get("file");
    const instanciaId = form.get("instanciaId");
    const modulo = form.get("modulo") as MediaModulo | null;
    const entidadTipo = form.get("entidadTipo") as string | null;
    const entidadId = form.get("entidadId") as string | null;
    const canalOrigen = (form.get("canalOrigen") as CanalOrigen | null) ?? "web";
    const creadoPorId = form.get("creadoPorId") as string | null;
    const guardarOriginal = form.get("guardarOriginal") === "true";

    // Validaciones de presencia
    if (!(file instanceof File)) {
      return err("Archivo inválido o no enviado.");
    }
    if (!instanciaId || typeof instanciaId !== "string") {
      return err("instanciaId es requerido.");
    }
    if (!modulo) {
      return err("modulo es requerido. Ej: 'productos', 'plantillas', 'logos'.");
    }

    const resultado = await subirMedia({
      file,
      instanciaId,
      modulo,
      entidadTipo: entidadTipo ?? undefined,
      entidadId: entidadId ?? undefined,
      canalOrigen,
      creadoPorId: creadoPorId ?? undefined,
      guardarOriginal,
    });

    const response: MediaUploadApiResponse = { ok: true, data: resultado };
    return NextResponse.json(response, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al procesar la imagen.";
    const response: MediaUploadApiError = { ok: false, error: message };
    return NextResponse.json(response, { status: 400 });
  }
}

function err(message: string) {
  const body: MediaUploadApiError = { ok: false, error: message };
  return NextResponse.json(body, { status: 400 });
}
