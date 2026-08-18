import { prisma } from "@/shared/db/prisma";
import { getStorageProvider } from "../providers/factory";
import { procesarImagen } from "../processor/image.processor";
import { validarArchivo, calcularHash, sanitizarNombre } from "../processor/validators";
import { getProveedorActivo } from "../config";
import type { MediaUploadInput, MediaUploadResult } from "../types";

function buildKeys(instanciaId: string, modulo: string, fileId: string) {
  const base = `${instanciaId}/${modulo}`;
  return {
    optimized: `${base}/optimized/${fileId}.webp`,
    thumbnail: `${base}/thumbs/${fileId}.webp`,
    original: (ext: string) => `${base}/originals/${fileId}.${ext}`,
  };
}

export async function subirMedia(input: MediaUploadInput): Promise<MediaUploadResult> {
  const { file, instanciaId, modulo, entidadTipo, entidadId, canalOrigen, creadoPorId, guardarOriginal } = input;

  // 1. Validar archivo
  const validacion = validarArchivo(file);
  if (!validacion.valido) throw new Error(validacion.error);

  // 2. Leer buffer y calcular hash
  const bufferOriginal = Buffer.from(await file.arrayBuffer());
  const hash = calcularHash(bufferOriginal);

  // 3. Deduplicación: ¿ya existe esta imagen para este tenant, subida con el
  // MISMO proveedor que está activo ahora? Si el proveedor cambió (ej. se
  // migró de `local` a `s3`), el archivo bajo el proveedor viejo puede ya no
  // existir físicamente (storage local efímero) — no basta con reusar sus
  // URLs, hay que volver a subirlo al proveedor activo.
  const proveedorActivo = getProveedorActivo();
  const existente = await prisma.mediaArchivo.findUnique({
    where: { instanciaId_hash: { instanciaId, hash } },
  });

  if (existente && existente.proveedor === proveedorActivo) {
    return {
      id: existente.id,
      urlOptimizada: existente.urlOptimizada,
      urlThumbnail: existente.urlThumbnail,
      urlOriginal: existente.urlOriginal,
      urlPublica: `/m/${existente.id}`,
      pesoOriginal: existente.pesoOriginal,
      pesoOptimizado: existente.pesoOptimizado,
      ancho: existente.ancho,
      alto: existente.alto,
      hash: existente.hash,
      deduplicado: true,
    };
  }

  // 4. Procesar imagen con sharp
  const { optimized, thumbnail } = await procesarImagen({
    buffer: bufferOriginal,
    mimeType: file.type,
  });

  // 5. Generar ID único y claves de storage
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const keys = buildKeys(instanciaId, modulo, fileId);
  const provider = getStorageProvider();

  // 6. Subir optimizado + thumbnail en paralelo (+ original opcional)
  const uploads: Promise<void>[] = [
    provider.upload({ key: keys.optimized, buffer: optimized.buffer, contentType: "image/webp" }).then(() => undefined),
    provider.upload({ key: keys.thumbnail, buffer: thumbnail.buffer, contentType: "image/webp" }).then(() => undefined),
  ];

  let keyOriginalGuardado: string | null = null;
  if (guardarOriginal) {
    const ext = sanitizarNombre(file.name).split(".").pop() ?? "bin";
    keyOriginalGuardado = keys.original(ext);
    uploads.push(
      provider.upload({ key: keyOriginalGuardado, buffer: bufferOriginal, contentType: file.type }).then(() => undefined)
    );
  }

  await Promise.all(uploads);

  // 7. Construir URLs finales
  const urlOptimizada = provider.getPublicUrl(keys.optimized);
  const urlThumbnail = provider.getPublicUrl(keys.thumbnail);
  const urlOriginal = keyOriginalGuardado ? provider.getPublicUrl(keyOriginalGuardado) : null;

  // 8. Registrar en base de datos — si ya había un registro con este hash pero
  // de un proveedor viejo, se actualiza (el hash es único por tenant, no se
  // puede crear una fila nueva con el mismo instanciaId+hash).
  const datosArchivo = {
    modulo,
    entidadTipo: entidadTipo ?? null,
    entidadId: entidadId ?? null,
    nombreOriginal: sanitizarNombre(file.name),
    mimeOriginal: file.type,
    pesoOriginal: file.size,
    mimeOptimizado: "image/webp" as const,
    pesoOptimizado: optimized.peso,
    ancho: optimized.ancho,
    alto: optimized.alto,
    keyOptimizado: keys.optimized,
    keyThumbnail: keys.thumbnail,
    keyOriginal: keyOriginalGuardado,
    urlOptimizada,
    urlThumbnail,
    urlOriginal,
    proveedor: proveedorActivo,
    estadoProcesado: "LISTO" as const,
  };

  const registro = existente
    ? await prisma.mediaArchivo.update({
        where: { id: existente.id },
        data: datosArchivo,
      })
    : await prisma.mediaArchivo.create({
        data: {
          instanciaId,
          hash,
          canalOrigen: canalOrigen ?? null,
          creadoPorId: creadoPorId ?? null,
          ...datosArchivo,
        },
      });

  return {
    id: registro.id,
    urlOptimizada,
    urlThumbnail,
    urlOriginal,
    urlPublica: `/m/${registro.id}`,
    pesoOriginal: file.size,
    pesoOptimizado: optimized.peso,
    ancho: optimized.ancho,
    alto: optimized.alto,
    hash,
    deduplicado: false,
  };
}

export async function vincularMediaArchivo(
  mediaId: string,
  entidadId: string,
  entidadTipo: string
): Promise<void> {
  await prisma.mediaArchivo.update({
    where: { id: mediaId },
    data: { entidadId, entidadTipo },
  });
}
