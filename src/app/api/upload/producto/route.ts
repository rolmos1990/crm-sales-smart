import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const productoId = form.get("productoId");
    const instancia = (form.get("instancia") as string | null) ?? "default";

    if (!(file instanceof File)) return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    if (!productoId || typeof productoId !== "string") return NextResponse.json({ error: "productoId requerido" }, { status: 400 });
    if (!ACCEPTED.includes(file.type)) return NextResponse.json({ error: "Formato no soportado. Usa JPG, PNG o WebP." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imagen demasiado grande (máx. 5 MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Comprimir y convertir a WebP — max 800×800, calidad 75
    const procesado = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const relDir = path.join("uploads", instancia, "producto");
    const absDir = path.join(process.cwd(), "public", relDir);
    await fs.mkdir(absDir, { recursive: true });

    const filename = `${productoId}.webp`;
    await fs.writeFile(path.join(absDir, filename), procesado);

    const url = `/${relDir.replace(/\\/g, "/")}/${filename}`;
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Error al procesar la imagen" }, { status: 500 });
  }
}
