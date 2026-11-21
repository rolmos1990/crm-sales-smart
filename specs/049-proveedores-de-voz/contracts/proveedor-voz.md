# Contrato: adaptador de proveedor de voz

Internal contract entre el dominio y cualquier servicio de voz (Principio IV: la lógica de
negocio no depende de tipos, payloads ni códigos de error del SDK del proveedor).

## Interfaz

```ts
// src/voz/proveedores/types.ts
export interface IProveedorVoz {
  readonly nombre: ProveedorVozEnum;
  transcribir(params: TranscribirParams): Promise<TranscribirResult>;
  estaDisponible(): Promise<boolean>;
}

export interface TranscribirParams {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo: string;
  /** ISO-639-1. Omitir = autodetección. Hoy siempre se omite (research R9). */
  idioma?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface TranscribirResult {
  /** Texto crudo del proveedor. El dominio decide si es INAUDIBLE, no el adaptador. */
  texto: string;
  idioma: string | null;
  confianzaIdioma: number | null;
  /** Elementos de habla reconocidos. 0 ⇒ el audio no tenía voz. */
  palabras: number;
  segundos: number | null;
  modelo: string;
  proveedor: ProveedorVozEnum;
  tiempoMs: number;
}
```

### Registro

```ts
// src/voz/proveedores/registro.ts
export function registrarProveedorVoz(
  nombre: ProveedorVozEnum,
  fabrica: (apiKey: string, modelo?: string, baseUrl?: string) => IProveedorVoz,
): void;

export function crearProveedorVoz(
  nombre: ProveedorVozEnum,
  apiKey: string,
  modelo?: string,
  baseUrl?: string,
): IProveedorVoz;
```

> `baseUrl` **sí** viaja hasta la fábrica. En el registro de IA se persiste y se edita en la UI
> pero nunca llega al adaptador (`src/ai/proveedores/registro.ts`, fábrica `(apiKey, modelo?)`);
> ese defecto no se replica. Ver research R3.

`src/voz/proveedores/disponibles.ts` exporta `PROVEEDORES_VOZ_IMPLEMENTADOS` sin dependencias de
servidor, para que lo importen a la vez la Server Action y el formulario cliente. Un test
mantiene esa lista sincronizada con el registro real.

## Obligaciones de todo adaptador

1. **Timeout propio.** Respeta `timeoutMs` y aborta. Nunca una llamada sin techo.
2. **No interpreta el resultado.** Devuelve texto, idioma, confianza y conteo de palabras. La
   decisión `LISTO` / `INAUDIBLE` es del dominio, igual para todos los proveedores.
3. **Errores traducidos.** Clasifica a un error de dominio con `reintentable: boolean`. Sin
   credencial, credencial inválida o formato no soportado ⇒ **no reintentable**. Timeout, 429 y
   5xx ⇒ reintentable.
4. **Nada de credenciales ni de contenido en logs** (FR-032).
5. **`estaDisponible()` se usa de verdad**, desde la acción "probar credenciales" (FR-005).

## Adaptador ELEVENLABS

| | |
|---|---|
| Endpoint | `POST {baseUrl ?? "https://api.elevenlabs.io"}/v1/speech-to-text` |
| Auth | header `xi-api-key: <apiKey>` |
| Cuerpo | `multipart/form-data` |
| Campos | `file` (binario), `model_id` (default `scribe_v3`) |
| Modo | **síncrono**. Sin `webhook`, sin `source_url` (research R4) |
| Disponibilidad | `GET /v1/user` — 2xx ⇒ credencial válida |

`FormData`, `Blob` y `fetch` son globales en Node 20: sin dependencia nueva.

### Respuesta relevante

```jsonc
{
  "language_code": "spa",
  "language_probability": 0.98,
  "text": "Hola, quería consultar por el precio del combo",
  "words": [ { "text": "Hola", "type": "word", "start": 0.1, "end": 0.4 } ]
}
```

Mapeo: `texto ← text`, `idioma ← language_code`, `confianzaIdioma ← language_probability`,
`palabras ← words.filter(w => w.type === "word").length`, `segundos ← ceil(max(words[].end))`.

> `words[].type` puede ser `word`, `spacing` o `audio_event`. Un audio de solo música devuelve
> `audio_event` y ningún `word`: por eso el conteo es de `word`, no de `words.length`.

## Decisión de dominio: `LISTO` vs `INAUDIBLE`

Se aplica igual para todo proveedor, en `src/voz/transcribir.ts`:

```
INAUDIBLE  ⟸  texto.trim() === ""
           ∨  palabras === 0
           ∨  (confianzaIdioma !== null ∧ confianzaIdioma < 0.5)
LISTO      ⟸  en cualquier otro caso
```

`INAUDIBLE` guarda el literal `"Inaudible"` y **es terminal: no se reintenta** (FR-017, R6).

## Registro de consumo

Toda llamada al proveedor —exitosa o no— escribe una fila en `UsoVoz` con `segundos`,
`proveedorVozId`, `modelo`, `tiempoMs`, `exito` y `entidadTipo: "MediaArchivo"` /
`entidadId`. `costoEstimado = (segundos / 3600) × costoPorHora`, o `null` si no hay tarifa
(research R7).
