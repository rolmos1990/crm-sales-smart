/**
 * Genera `public/asistente/karia-sprite.webp` a partir de la cuadrícula 4×4
 * de la mascota (`assets/asistente/KariAI.png`).
 *
 * La fuente no tiene canal alfa (fondo blanco hueso), así que el fondo se
 * quita acá: flood fill desde los bordes superior/izquierdo/derecho — no desde
 * abajo, porque el torso toca ese borde — en lugar de un chroma key global,
 * que se llevaría también el blanco del casco. Detalle y alternativas
 * descartadas: specs/038-asistente-karia-flotante/research.md (Decisiones 1–3).
 *
 * Uso:
 *   npx tsx scripts/generar-sprite-karia.ts
 *   npx tsx scripts/generar-sprite-karia.ts --ya-transparente   # fuente con alfa
 */
import os from "node:os";
import path from "node:path";
import { mkdir, stat } from "node:fs/promises";
import sharp from "sharp";

const RAIZ = path.resolve(__dirname, "..");
const FUENTE = path.join(RAIZ, "assets/asistente/KariAI.png");
const DESTINO = path.join(RAIZ, "public/asistente/karia-sprite.webp");
const VISTA_PREVIA = path.join(os.tmpdir(), "karia-sprite-preview.png");

const COLUMNAS = 4;
const FILAS = 4;
const LADO_FRAME = 192;
const PESO_MAXIMO = 150 * 1024;

// Las celdas tienen una línea tenue de separación; se descartan unos px.
const MARGEN_CELDA = 4;
// Distancia RGB por debajo de la cual un píxel conectado al borde es "fondo".
const UMBRAL_FONDO = 22;
// Por encima de UMBRAL_FONDO * FACTOR_BORDE el píxel del contorno es opaco;
// en medio, alfa proporcional (antialias del recorte).
const FACTOR_BORDE = 3;
const BANDA_BORDE = 2;
// Fracción inferior del frame que se desvanece (el torso está cortado).
const FRACCION_DESVANECIDO = 0.15;

type Rgba = { datos: Buffer; ancho: number; alto: number };

const yaTransparente = process.argv.includes("--ya-transparente");

function distancia(d: Buffer, i: number, fondo: [number, number, number]) {
  const r = d[i] - fondo[0];
  const g = d[i + 1] - fondo[1];
  const b = d[i + 2] - fondo[2];
  return Math.sqrt(r * r + g * g + b * b);
}

function colorFondo(img: Rgba): [number, number, number] {
  // Solo esquinas superiores: en las inferiores pueden aparecer los hombros.
  const muestras: number[][] = [];
  const parche = 10;
  for (const x0 of [0, img.ancho - parche]) {
    for (let y = 0; y < parche; y++) {
      for (let x = x0; x < x0 + parche; x++) {
        const i = (y * img.ancho + x) * 4;
        muestras.push([img.datos[i], img.datos[i + 1], img.datos[i + 2]]);
      }
    }
  }
  const suma = muestras.reduce((a, m) => [a[0] + m[0], a[1] + m[1], a[2] + m[2]], [0, 0, 0]);
  return [suma[0] / muestras.length, suma[1] / muestras.length, suma[2] / muestras.length];
}

function quitarFondo(img: Rgba) {
  const { datos, ancho, alto } = img;
  const fondo = colorFondo(img);
  const esFondo = new Uint8Array(ancho * alto);
  const cola: number[] = [];

  const sembrar = (x: number, y: number) => {
    const p = y * ancho + x;
    if (esFondo[p]) return;
    if (distancia(datos, p * 4, fondo) < UMBRAL_FONDO) {
      esFondo[p] = 1;
      cola.push(p);
    }
  };
  for (let x = 0; x < ancho; x++) sembrar(x, 0);
  for (let y = 0; y < alto; y++) {
    sembrar(0, y);
    sembrar(ancho - 1, y);
  }
  while (cola.length) {
    const p = cola.pop()!;
    const x = p % ancho;
    const y = (p - x) / ancho;
    if (x > 0) sembrar(x - 1, y);
    if (x < ancho - 1) sembrar(x + 1, y);
    if (y > 0) sembrar(x, y - 1);
    if (y < alto - 1) sembrar(x, y + 1);
  }

  const cercaDeFondo = (x: number, y: number) => {
    for (let dy = -BANDA_BORDE; dy <= BANDA_BORDE; dy++) {
      for (let dx = -BANDA_BORDE; dx <= BANDA_BORDE; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
        if (esFondo[ny * ancho + nx]) return true;
      }
    }
    return false;
  };

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const p = y * ancho + x;
      const i = p * 4;
      if (esFondo[p]) {
        datos[i + 3] = 0;
        continue;
      }
      if (!cercaDeFondo(x, y)) continue;
      const d = distancia(datos, i, fondo);
      const a = Math.min(1, Math.max(0, (d - UMBRAL_FONDO) / (UMBRAL_FONDO * (FACTOR_BORDE - 1))));
      datos[i + 3] = Math.round(a * 255);
      // Un-matte: quitar el blanco hueso mezclado en el antialias para que no
      // quede halo claro sobre el tema oscuro.
      if (a > 0 && a < 1) {
        for (let c = 0; c < 3; c++) {
          const v = (datos[i + c] - (1 - a) * fondo[c]) / a;
          datos[i + c] = Math.max(0, Math.min(255, Math.round(v)));
        }
      }
    }
  }
}

/**
 * El ilustrador dibujó "líneas de movimiento" sueltas junto al casco en
 * algunos frames; sin fondo quedan flotando como basura. Se conserva solo la
 * componente conexa más grande (el robot).
 */
function conservarComponentePrincipal(img: Rgba) {
  const { datos, ancho, alto } = img;
  const etiqueta = new Int32Array(ancho * alto).fill(-1);
  const tamanos: number[] = [];
  const opaco = (p: number) => datos[p * 4 + 3] > 24;
  for (let inicio = 0; inicio < ancho * alto; inicio++) {
    if (etiqueta[inicio] !== -1 || !opaco(inicio)) continue;
    const id = tamanos.length;
    let tamano = 0;
    const cola = [inicio];
    etiqueta[inicio] = id;
    while (cola.length) {
      const p = cola.pop()!;
      tamano++;
      const x = p % ancho;
      const y = (p - x) / ancho;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
        const q = ny * ancho + nx;
        if (etiqueta[q] === -1 && opaco(q)) {
          etiqueta[q] = id;
          cola.push(q);
        }
      }
    }
    tamanos.push(tamano);
  }
  const principal = tamanos.indexOf(Math.max(...tamanos));
  for (let p = 0; p < ancho * alto; p++) {
    if (etiqueta[p] !== principal) datos[p * 4 + 3] = 0;
  }
}

function desvanecerBase(img: Rgba) {
  const { datos, ancho, alto } = img;
  const inicio = Math.floor(alto * (1 - FRACCION_DESVANECIDO));
  for (let y = inicio; y < alto; y++) {
    const f = 1 - (y - inicio) / (alto - inicio);
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4 + 3;
      datos[i] = Math.round(datos[i] * f);
    }
  }
}

/** Centro horizontal y tope de la cabeza (antena incluida), mitad superior. */
function anclaCabeza(img: Rgba) {
  const { datos, ancho, alto } = img;
  let minX = ancho;
  let maxX = -1;
  let minY = alto;
  for (let y = 0; y < alto / 2; y++) {
    for (let x = 0; x < ancho; x++) {
      if (datos[(y * ancho + x) * 4 + 3] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
      }
    }
  }
  return { cx: (minX + maxX) / 2, tope: minY };
}

function desplazar(img: Rgba, dx: number, dy: number): Rgba {
  const { datos, ancho, alto } = img;
  const salida = Buffer.alloc(datos.length);
  for (let y = 0; y < alto; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= alto) continue;
    for (let x = 0; x < ancho; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= ancho) continue;
      datos.copy(salida, (y * ancho + x) * 4, (sy * ancho + sx) * 4, (sy * ancho + sx) * 4 + 4);
    }
  }
  return { datos: salida, ancho, alto };
}

function mediana(valores: number[]) {
  const o = [...valores].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

async function main() {
  const meta = await sharp(FUENTE).metadata();
  const anchoFuente = meta.width!;
  const altoFuente = meta.height!;

  const limites = (n: number, total: number, i: number) => Math.round((i * total) / n);
  const ladoCelda =
    Math.min(
      ...Array.from({ length: COLUMNAS }, (_, c) => limites(COLUMNAS, anchoFuente, c + 1) - limites(COLUMNAS, anchoFuente, c)),
      ...Array.from({ length: FILAS }, (_, f) => limites(FILAS, altoFuente, f + 1) - limites(FILAS, altoFuente, f)),
    ) -
    MARGEN_CELDA * 2;

  const frames: Rgba[] = [];
  for (let f = 0; f < FILAS; f++) {
    for (let c = 0; c < COLUMNAS; c++) {
      const { data } = await sharp(FUENTE)
        .extract({
          left: limites(COLUMNAS, anchoFuente, c) + MARGEN_CELDA,
          top: limites(FILAS, altoFuente, f) + MARGEN_CELDA,
          width: ladoCelda,
          height: ladoCelda,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const img: Rgba = { datos: data, ancho: ladoCelda, alto: ladoCelda };
      if (!yaTransparente) quitarFondo(img);
      conservarComponentePrincipal(img);
      frames.push(img);
    }
  }

  const anclas = frames.map(anclaCabeza);
  const cxRef = mediana(anclas.map((a) => a.cx));
  const topeRef = mediana(anclas.map((a) => a.tope));
  const alineados = frames.map((img, i) => {
    const alineado = desplazar(img, Math.round(cxRef - anclas[i].cx), Math.round(topeRef - anclas[i].tope));
    if (!yaTransparente) desvanecerBase(alineado);
    return alineado;
  });

  const redimensionados = await Promise.all(
    alineados.map((img) =>
      sharp(img.datos, { raw: { width: img.ancho, height: img.alto, channels: 4 } })
        .resize(LADO_FRAME, LADO_FRAME, { kernel: "lanczos3" })
        .png()
        .toBuffer(),
    ),
  );

  const tira = sharp({
    create: {
      width: LADO_FRAME * redimensionados.length,
      height: LADO_FRAME,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(redimensionados.map((input, i) => ({ input, left: i * LADO_FRAME, top: 0 })));
  const tiraPng = await tira.png().toBuffer();

  await mkdir(path.dirname(DESTINO), { recursive: true });
  await sharp(tiraPng).webp({ quality: 85, alphaQuality: 100, effort: 6 }).toFile(DESTINO);

  await generarVistaPrevia(tiraPng, LADO_FRAME * redimensionados.length);

  const { size } = await stat(DESTINO);
  console.log(`Sprite: ${path.relative(RAIZ, DESTINO)} (${(size / 1024).toFixed(1)} KB)`);
  console.log(`Vista previa: ${VISTA_PREVIA}`);
  if (size > PESO_MAXIMO) {
    console.error(`El sprite supera ${PESO_MAXIMO / 1024} KB.`);
    process.exit(1);
  }
}

async function generarVistaPrevia(tiraPng: Buffer, ancho: number) {
  const cuadro = 16;
  const svgCuadros = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${LADO_FRAME}">
    <defs><pattern id="p" width="${cuadro * 2}" height="${cuadro * 2}" patternUnits="userSpaceOnUse">
      <rect width="${cuadro * 2}" height="${cuadro * 2}" fill="#ffffff"/>
      <rect width="${cuadro}" height="${cuadro}" fill="#d0d0d0"/>
      <rect x="${cuadro}" y="${cuadro}" width="${cuadro}" height="${cuadro}" fill="#d0d0d0"/>
    </pattern></defs>
    <rect width="100%" height="100%" fill="url(#p)"/></svg>`;
  await sharp({
    create: { width: ancho, height: LADO_FRAME * 2, channels: 4, background: { r: 24, g: 26, b: 27, alpha: 1 } },
  })
    .composite([
      { input: Buffer.from(svgCuadros), left: 0, top: 0 },
      { input: tiraPng, left: 0, top: 0 },
      { input: tiraPng, left: 0, top: LADO_FRAME },
    ])
    .png()
    .toFile(VISTA_PREVIA);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
