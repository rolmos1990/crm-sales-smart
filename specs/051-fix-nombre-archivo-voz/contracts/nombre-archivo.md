# Contrato: nombre de archivo y recuperación

**Feature**: `051-fix-nombre-archivo-voz` | **Date**: 2026-11-21

Tres piezas: una función pura, un invariante y un script.

---

## 1. `nombreConExtension` — `src/voz/nombre-archivo.ts`

```ts
export function nombreConExtension(nombre: string, claveStorage: string | null): string
```

Devuelve el nombre con una extensión, tomándola de la clave de storage cuando el nombre no la
trae.

### Reglas

| Caso | Resultado |
|---|---|
| El nombre ya termina en **la extensión de la clave** | se devuelve **sin tocar** (FR-003) |
| El nombre termina en **otra** extensión | `<nombre>.<ext de la clave>` |
| El nombre no trae extensión | `<nombre>.<ext de la clave>` |
| La clave no trae extensión, o es `null` | el nombre **sin tocar** — no se inventa nada (FR-002) |
| El nombre está vacío o en blanco | se usa `audio` como base |

> **Corregido durante la implementación.** El contrato original decía "el nombre ya termina en
> extensión → sin tocar", y eso **no se puede implementar**: `archivo.de.audio` termina en
> `.audio`, cinco caracteres alfanuméricos, indistinguible de una extensión real para cualquier
> expresión regular. El test lo detectó. La regla no usa heurística: la única pregunta es si el
> nombre ya termina en **la extensión que la clave declara**. La clave refleja lo que el archivo
> realmente es; el nombre es un dato suelto del canal.
>
> La consecuencia visible es que `nota.mp3` sobre una clave `.mp4` pasa a ser `nota.mp3.mp4`. Es
> un nombre feo en un caso que **no ocurre** —los 744 audios de producción no tienen extensión en
> el nombre— y es lo correcto: mandar un mp4 llamado `.mp3` es pedirle al proveedor que lo
> interprete mal.

La extensión se compara y se agrega en minúsculas: los proveedores validan contra una lista en
minúsculas.

La función es **idempotente**: aplicarla dos veces da lo mismo que aplicarla una.

### Lo que la función NO hace

- **No consulta el mime.** La clave ya codifica la extensión que el sistema derivó del mime al
  guardar el archivo, parámetros del mime incluidos (Decisión 1 de [../research.md](../research.md)).
- **No valida contra la lista de formatos del proveedor.** Esa lista es de cada proveedor y
  cambia sin avisar; si la extensión no le sirve, el proveedor lo dice y el error es correcto.
- **No sanea el nombre.** Lo que llega ya pasó por `sanitizarNombre` al guardarse.

### Casos borde que el test cubre

- `("audio-1795275488865", ".../1795268255346-m56krsk.mp4")` → `audio-1795275488865.mp4` — el
  caso real que motiva el hotfix.
- `("audio-123", ".../x.ogg")` → `audio-123.ogg` — WhatsApp.
- `("nota.mp4", ".../x.mp4")` → `nota.mp4` — ya correcta, no se duplica.
- `("nota.mp3", ".../x.mp4")` → `nota.mp3.mp4` — la clave manda sobre el nombre.
- `("audio-123", ".../x")` → `audio-123` — sin extensión en ningún lado, se degrada al
  comportamiento actual.
- `("audio-123", null)` → `audio-123`.
- `("", ".../x.mp4")` → `audio.mp4`.
- `("audio-123", ".../X.MP4")` → `audio-123.mp4` — normalizado a minúsculas.
- `("archivo.de.audio", ".../x.ogg")` → `archivo.de.audio.ogg` — **el caso que rompió el contrato
  original** y que la regla sin heurística resuelve.
- Idempotencia: `f(f(x)) === f(x)`.

---

## 2. El invariante — `src/voz/transcribir.ts`

```ts
nombreArchivo: nombreConExtension(media.nombreOriginal, key)
```

donde `key` es la clave de storage que la función ya calcula en `transcribir.ts:90` para
descargar el archivo (`media.keyOriginal ?? media.keyOptimizado`).

### Invariante (el motivo de arreglarlo acá y no en los adaptadores)

> **Todo `nombreArchivo` que llega a `IProveedorVoz.transcribir()` lleva extensión siempre que el
> archivo tenga una clave de storage con extensión** — con cualquier proveedor, presente o futuro.

El test lo verifica con un proveedor falso que captura lo que recibe, no mirando el código de los
adaptadores. Un adaptador nuevo queda cubierto sin que nadie se acuerde de nada.

### Qué NO cambia en `transcribir.ts`

`mimeType` sigue siendo `media.mimeOriginal`, los tres cortes de alcance de 049 siguen donde
están, el timeout se sigue calculando igual y el registro de uso no se toca.

---

## 3. `scripts/051-recuperar-formato-no-soportado.ts`

Sigue la convención de `scripts/049-backfill-transcripciones.ts`.

```bash
npx tsx scripts/051-recuperar-formato-no-soportado.ts                     # simula
npx tsx scripts/051-recuperar-formato-no-soportado.ts --instancia <id>    # simula, una cuenta
npx tsx scripts/051-recuperar-formato-no-soportado.ts --aplicar           # escribe
```

### Reglas

| Regla | Comportamiento |
|---|---|
| Por defecto | **simula**: lista qué recuperaría y **no escribe nada** (FR-009) |
| Selección | `MediaArchivo` en `ERROR` **con** una fila de `UsoVoz` cuyo código es el de formato no soportado (FR-010) |
| Otras causas | **no se tocan** — los 2 fallos contra ElevenLabs quedan como están |
| Escritura | `marcarPendiente({ ..., reiniciarIntentos: true })`, una fila a la vez |
| Tenant | va por `instanciaId`; `--instancia` acota a una cuenta |
| Nada que hacer | lo informa y termina con éxito, sin error (US2 escenario 4) |
| Idempotencia | una segunda corrida no encuentra nada: las filas ya no están en `ERROR` |
| En curso | no puede tocar un `PROCESANDO`, un `LISTO` ni un `INAUDIBLE` — guardia de `cola.ts:55` |

### Qué reporta

Por cuenta: cuántos audios se recuperarían, con su id y el código del fallo. Al final, el total y
—en modo simulación— un recordatorio de que hay que pasar `--aplicar`.

**No reporta el texto de ninguna transcripción** ni ningún dato del contacto: es un script de
operación, no una herramienta de lectura de conversaciones.

### Lo que el script NO hace

- **No transcribe.** Devuelve a la cola; el worker hace el resto, con el tope diario y el
  registro de uso de siempre (FR-012).
- **No se ejecuta solo.** No hay barrido automático que resucite errores: los demás errores
  definitivos lo son por buenas razones (Assumptions del spec).
- **No recupera nada si el arreglo no está desplegado**, porque volvería a fallar igual. El
  quickstart lo pone como prerrequisito explícito.
