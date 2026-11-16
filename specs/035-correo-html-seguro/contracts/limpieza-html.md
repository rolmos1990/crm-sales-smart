# Contrato: limpieza de HTML (worker y servidor)

Ubicación: `src/integraciones/email/mensaje/html/`. Es un módulo **apto para el worker**: no importa
`server-only`, Next ni Prisma. Lo verifica `grafo-importaciones.test.ts`.

## `limpiarHtmlEntrante(html: string): ResultadoLimpieza`

Se ejecuta al recibir el correo, en `normalizarCorreo`.

```ts
type MotivoHtmlNoDisponible =
  | "DEMASIADO_GRANDE" | "DEMASIADO_ANIDADO" | "TIEMPO_EXCEDIDO" | "ERROR_LIMPIEZA";

type ResultadoLimpieza =
  | { estado: "SIN_HTML"; motivo: "VACIO" | null }
  | { estado: "NO_DISPONIBLE"; motivo: MotivoHtmlNoDisponible }
  | {
      estado: "DISPONIBLE";
      html: string;                 // limpio; imágenes remotas como data-karia-externa="N", sin src
      imagenesExternas: string[];   // URLs http(s), índice = N, máximo 50
      cidsUsados: string[];         // cid sin "<>", en minúsculas
      versionPolitica: number;
    };
```

Garantías:
- **No lanza nunca.** Cualquier excepción interna devuelve `NO_DISPONIBLE` / `ERROR_LIMPIEZA`.
- **Aplica los límites de research R3**, en este orden: tamaño de entrada, pre-chequeo de profundidad,
  limpieza, tiempo medido y tamaño de salida.
- Si el resultado no tiene texto visible ni imágenes, devuelve `SIN_HTML` con motivo `VACIO`.
- **Nunca devuelve ni registra en logs el HTML original.**

## `prepararHtmlParaVista(htmlLimpio, opciones): string`

Se ejecuta al servir, en la ruta de vista. Vuelve a pasar el HTML por la **misma política** y, con
`transformTags`:
- `img[src^="cid:"]`: el `src` pasa a `opciones.urlCid(cid)`, o se quita si el cid no está en el mapa.
- `img[data-karia-externa=N]`: el `src` pasa a `opciones.urlImagenExterna(N)` cuando
  `opciones.imagenes === true`. Si no, el `img` queda sin `src`.
- Todo `a[href]`: se fuerzan `target="_blank"` y `rel="noopener noreferrer nofollow"`.

## `DatosCorreoEntrante` (campo `correo` del comando `ProcesarEntrante`)

```ts
interface DatosCorreoEntrante {
  estadoHtml: "SIN_HTML" | "DISPONIBLE" | "NO_DISPONIBLE";
  motivoHtml: string | null;
  htmlLimpio: string | null;
  versionPolitica: number;
  imagenesExternas: string[];
  adjuntos: AdjuntoCorreo[];
  de: DireccionCorreo | null;
  para: DireccionCorreo[]; paraTotal: number;
  cc: DireccionCorreo[];   ccTotal: number;
  asunto: string | null;
  fechaEnvio: string | null;  // ISO 8601 UTC
}
```

## Catálogo de pruebas obligatorio (`limpiar-html.test.ts`)

Cada caso verifica **ausencia en la salida**, no solo que la función "no falle".

| # | Entrada | Esperado |
|---|---|---|
| 1 | Correo comercial: tablas, colores, listas y `<img src="cid:logo">` | Se conserva la estructura y el `cid` aparece en `cidsUsados` |
| 2 | `<script>`, `<script src>`, `<noscript>` | No aparece ningún `script`; el texto del script tampoco |
| 3 | `onerror`, `onclick`, `onload`, `OnMouseOver` (mayúsculas) | No queda ningún atributo `on*` |
| 4 | `href="javascript:…"`, `JaVaScRiPt:`, `&#106;avascript:`, `data:text/html`, `vbscript:`, `//evil.com` | El `href` desaparece |
| 5 | HTML malformado: etiquetas sin cerrar, atributos rotos, comentarios condicionales de Outlook | No lanza y la salida es HTML bien formado |
| 6 | `style="background:url(…)"`, `expression(…)`, `@import`, `position:fixed`, `behavior:` | La propiedad desaparece y las demás se conservan |
| 7 | `<svg onload>`, `<math>`, `<svg><script>` | Desaparecen por completo |
| 8 | `<form>`, `<input>`, `<button>`, `<iframe>`, `<object>`, `<embed>`, `<meta http-equiv=refresh>`, `<base>`, `<link>` | Desaparecen |
| 9 | Píxel de rastreo `<img src="https://t.co/p.gif" width=1 height=1>` | Sin `src`, con `data-karia-externa`, y aparece en `imagenesExternas` |
| 10 | HTML de 1 MB + 1 byte | `NO_DISPONIBLE` / `DEMASIADO_GRANDE` |
| 11 | 5 000 `<div>` anidados | `NO_DISPONIBLE` / `DEMASIADO_ANIDADO`, en menos de 1 s |
| 12 | Solo `<script>` y `<style>` | `SIN_HTML` / `VACIO` |
| 13 | `<a href="https://x.com">` | `target="_blank" rel="noopener noreferrer nofollow"` |
| 14 | `srcset`, `<picture><source>`, `background=` | No queda ninguna vía de carga remota |
