import { generarSlug } from "@/shared/lib/slug";
import { claveDeReferencia, MAX_REFERENCIAS } from "./parser";
import {
  ETIQUETA_TIPO_REFERENCIA,
  type OpcionReferencia,
  type Referencia,
  type ReferenciaResuelta,
  type TipoReferencia,
} from "./tipos";

// Una query por TIPO presente, nunca una por referencia: un agente con 10
// plantillas referenciadas hace una sola consulta de plantillas.

/**
 * Candidatos de cada tipo dentro de una instancia. Es la misma lectura que
 * alimenta el menú de autocompletado y la resolución en runtime — así lo que
 * el usuario eligió del menú es exactamente lo que después resuelve el prompt.
 */
async function listarCandidatos(instanciaId: string): Promise<OpcionReferencia[]> {
  const { prisma } = await import("@/shared/db/prisma");
  const opciones: OpcionReferencia[] = [];

  const [plantillas, usuarios, productos] = await Promise.all([
    prisma.plantillaCRM.findMany({
      where: { instanciaId, activo: true },
      select: { nombre: true, alias: true, descripcion: true, contenidoTexto: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuarioInstancia.findMany({
      where: { instanciaId, activo: true },
      select: { rol: true, usuario: { select: { nombre: true, email: true, cargo: true } } },
      orderBy: { creadoEn: "asc" },
    }),
    prisma.producto.findMany({
      where: { instanciaId, activo: true },
      select: {
        nombre: true,
        sku: true,
        descripcion: true,
        precio: true,
        moneda: true,
        unidad: true,
        categoria: true,
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  for (const p of plantillas) {
    opciones.push({
      tipo: "plantilla",
      clave: p.alias,
      token: `@plantilla:${p.alias}`,
      etiqueta: p.nombre,
      detalle: p.descripcion || (p.contenidoTexto ?? "").slice(0, 80),
    });
  }

  for (const ui of usuarios) {
    opciones.push({
      tipo: "usuario",
      clave: generarSlug(ui.usuario.nombre),
      token: `@usuario:${generarSlug(ui.usuario.nombre)}`,
      etiqueta: ui.usuario.nombre,
      detalle: ui.usuario.cargo || ui.usuario.email,
    });
  }

  for (const p of productos) {
    opciones.push({
      tipo: "producto",
      clave: generarSlug(p.nombre),
      token: `@producto:${generarSlug(p.nombre)}`,
      etiqueta: p.nombre,
      detalle: `${p.moneda} ${Number(p.precio).toFixed(2)}${p.categoria ? ` · ${p.categoria}` : ""}`,
    });
  }

  return opciones;
}

/** Texto que se inyecta en el prompt por cada tipo. */
async function contenidosPorClave(
  instanciaId: string,
  tipos: Set<TipoReferencia>,
): Promise<Map<string, { etiqueta: string; contenido: string }[]>> {
  const { prisma } = await import("@/shared/db/prisma");
  const porClave = new Map<string, { etiqueta: string; contenido: string }[]>();

  const agregar = (clave: string, valor: { etiqueta: string; contenido: string }) => {
    const existentes = porClave.get(clave);
    if (existentes) existentes.push(valor);
    else porClave.set(clave, [valor]);
  };

  const [plantillas, usuarios, productos] = await Promise.all([
    tipos.has("plantilla")
      ? prisma.plantillaCRM.findMany({
          where: { instanciaId, activo: true },
          select: { nombre: true, alias: true, contenidoTexto: true, imagenUrl: true },
        })
      : Promise.resolve([]),
    tipos.has("usuario")
      ? prisma.usuarioInstancia.findMany({
          where: { instanciaId, activo: true },
          select: { rol: true, usuario: { select: { nombre: true, email: true, cargo: true } } },
        })
      : Promise.resolve([]),
    tipos.has("producto")
      ? prisma.producto.findMany({
          where: { instanciaId, activo: true },
          select: {
            nombre: true,
            sku: true,
            descripcion: true,
            precio: true,
            moneda: true,
            unidad: true,
            categoria: true,
          },
        })
      : Promise.resolve([]),
  ]);

  for (const p of plantillas) {
    const lineas = [p.contenidoTexto?.trim() || "(plantilla sin texto)"];
    // La imagen no se puede adjuntar desde el prompt (la respuesta del agente
    // es solo texto), pero que sepa que existe evita que prometa un archivo.
    if (p.imagenUrl) lineas.push("(esta plantilla tiene una imagen adjunta que vos no podés enviar)");
    agregar(`plantilla:${p.alias}`, {
      etiqueta: `${ETIQUETA_TIPO_REFERENCIA.plantilla} · ${p.nombre}`,
      contenido: lineas.join("\n"),
    });
  }

  for (const ui of usuarios) {
    const u = ui.usuario;
    const datos = [u.cargo && `Cargo: ${u.cargo}`, `Rol: ${ui.rol}`].filter(Boolean);
    agregar(`usuario:${generarSlug(u.nombre)}`, {
      etiqueta: `${ETIQUETA_TIPO_REFERENCIA.usuario} · ${u.nombre}`,
      // Sin email ni teléfono: es contacto interno y el agente le habla al cliente.
      contenido: `${u.nombre} — ${datos.join(" · ")}`,
    });
  }

  for (const p of productos) {
    const datos = [
      `Precio: ${p.moneda} ${Number(p.precio).toFixed(2)} por ${p.unidad}`,
      p.sku && `SKU: ${p.sku}`,
      p.categoria && `Categoría: ${p.categoria}`,
      p.descripcion?.trim(),
    ].filter(Boolean);
    agregar(`producto:${generarSlug(p.nombre)}`, {
      etiqueta: `${ETIQUETA_TIPO_REFERENCIA.producto} · ${p.nombre}`,
      contenido: `${p.nombre} — ${datos.join(" · ")}`,
    });
  }

  return porClave;
}

/**
 * Resuelve referencias contra la instancia. Una clave con cero coincidencias
 * —o con más de una, p.ej. dos productos con el mismo nombre— queda SIN
 * resolver: nunca se adivina cuál de los dos quiso el usuario. El token se
 * deja literal y el editor lo marca.
 */
export async function resolverReferencias(
  instanciaId: string,
  referencias: Referencia[],
): Promise<Map<string, ReferenciaResuelta>> {
  const resueltas = new Map<string, ReferenciaResuelta>();
  if (referencias.length === 0) return resueltas;

  const aResolver = referencias.slice(0, MAX_REFERENCIAS);
  const tipos = new Set(aResolver.map((r) => r.tipo));
  const porClave = await contenidosPorClave(instanciaId, tipos);

  for (const ref of aResolver) {
    const candidatos = porClave.get(claveDeReferencia(ref));
    if (candidatos?.length !== 1) continue;
    resueltas.set(claveDeReferencia(ref), { ...ref, ...candidatos[0] });
  }

  return resueltas;
}

/** Candidatos para el menú de autocompletado, filtrados por lo que ya escribió el usuario. */
export async function buscarOpcionesReferencia(
  instanciaId: string,
  consulta: string,
): Promise<OpcionReferencia[]> {
  const todas = await listarCandidatos(instanciaId);

  // Solo claves inequívocas: si dos productos se llaman igual, ofrecerlos
  // llevaría a un token que después no resuelve.
  const vecesPorClave = new Map<string, number>();
  for (const o of todas) {
    const k = claveDeReferencia(o);
    vecesPorClave.set(k, (vecesPorClave.get(k) ?? 0) + 1);
  }
  const unicas = todas.filter((o) => vecesPorClave.get(claveDeReferencia(o)) === 1);

  const q = consulta.trim().toLowerCase();
  if (!q) return unicas;

  return unicas.filter(
    (o) =>
      o.clave.includes(q.replace(/\s+/g, "-")) ||
      o.etiqueta.toLowerCase().includes(q) ||
      o.tipo.startsWith(q) ||
      o.detalle.toLowerCase().includes(q),
  );
}
