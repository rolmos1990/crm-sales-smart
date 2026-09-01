# Contratos: `src/ai/autonomia/`

## `clasificarCategoriaIntencion(mensaje, instanciaId)` (`clasificador.ts`)

```ts
async function clasificarCategoriaIntencion(
  mensaje: string,
  instanciaId: string,
): Promise<{ categorias: Array<{ categoria: CategoriaIntencionAutonomia; confianza: number }> } | null>
```

- **Comportamiento**: llama a `generarRespuesta({ tarea: "CLASIFICACION", ... })` pidiendo la(s) categoría(s) más probables con su confianza; parsea con Zod. Devuelve `null` ante cualquier fallo (IA no habilitada, error de proveedor, resultado no parseable) — nunca lanza.

## `decidirAutonomia(configsPorCategoria, clasificacion, perfilCliente?)` (`gate.ts`)

```ts
interface DecisionAutonomia {
  accion: "ENVIAR" | "PENDIENTE" | "NO_GENERAR";
  motivo: string;
  categoriaAplicada?: CategoriaIntencionAutonomia;
}

function decidirAutonomia(
  configsPorCategoria: Map<CategoriaIntencionAutonomia, AutonomiaIntencionConfig> | null, // null = sin ninguna fila para el agente
  clasificacion: { categorias: Array<{ categoria: CategoriaIntencionAutonomia; confianza: number }> } | null,
  perfilCliente?: PerfilCliente | null,
): DecisionAutonomia
```

- **Comportamiento**:
  1. Si `configsPorCategoria === null` (sin ninguna fila configurada para el agente) → `{ accion: "ENVIAR", motivo: "Sin configuración de autonomía — comportamiento por defecto" }` (FR-004), **sin necesidad de que `clasificacion` exista** (research.md Decisión 3 — este caso ni siquiera debería llegar a llamar al clasificador).
  2. Si `clasificacion === null` (falló la clasificación) → mismo resultado que (1) (FR-010).
  3. Si no, para cada categoría detectada en `clasificacion.categorias`, resolver su config (o `AUTO_REPLY_SAFE_INTENTS` implícito si esa categoría puntual no tiene fila — coherente con "seguro por defecto"); aplicar el orden de severidad de `research.md` Decisión 5 y quedarse con el nivel más severo.
  4. Si el nivel resultante es `HUMAN_ONLY` → `{ accion: "NO_GENERAR", motivo, categoriaAplicada }` (FR-008).
  5. Si es `SUGGESTION_ONLY` → `{ accion: "PENDIENTE", motivo, categoriaAplicada }` (FR-007).
  6. Si es `AUTO_REPLY_SAFE_INTENTS` → `{ accion: "ENVIAR", motivo, categoriaAplicada }` (FR-006).
  7. Si es `CONDITIONAL_AUTOMATION` → evaluar `condicionesConfianza` contra la confianza de la clasificación y (si se pide) contra `perfilCliente`; `ENVIAR` si se cumplen todas, `PENDIENTE` si no (FR-006/FR-007, Edge Case "sin condiciones definidas" → tratado como no cumplidas).
- **Función pura**: sin I/O — el suscriptor le pasa datos ya cargados.

## Modificación de `generar-respuesta-ia.suscriptor.ts`

Después de generar `contenidoFinal` (ya sea con o sin tools) y antes de llamar a `enviarMensaje`:

```ts
const configs = await obtenerAutonomiaPorAgente(agenteId); // null si no hay ninguna fila
const clasificacion = configs ? await clasificarCategoriaIntencion(mensajeUsuarioTexto, instanciaId) : null;
const decision = decidirAutonomia(configs, clasificacion, await obtenerPerfilSiDisponible(conversacion.contactoId, instanciaId));

if (decision.accion === "NO_GENERAR") {
  console.log(`[GenerarRespuestaIA] Categoría ${decision.categoriaAplicada} es HumanOnly — no se genera respuesta automática`);
  return;
}
if (decision.accion === "PENDIENTE") {
  await crearRespuestaPendiente({ instanciaId, agenteIAConfigId: agenteId, conversacionId, mensajeCliente: /* ... */, respuestaPropuesta: contenidoFinal, motivoPendiente: decision.motivo, categoriaDetectada: decision.categoriaAplicada });
  return;
}
// decision.accion === "ENVIAR" → continúa exactamente igual que hoy
const resultado = await enviarMensaje({ /* ... */ });
```

Ningún llamador que no tenga configuración (`configs === null`) ejecuta la rama de clasificación — cero cambio de comportamiento ni de costo para esos agentes (FR-004).

## `src/ai/autonomia/actions.ts` — bandeja de revisión (Historia 3)

### `listarRespuestasPendientes()` — scoped a instancia, filtrable por conversación/agente.

### `enviarRespuestaPendiente(id)`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: llama a `enviarMensaje` con `respuestaPropuesta` tal cual, marca `estado: ENVIADA_TAL_CUAL`.

### `editarYEnviarRespuestaPendiente(id, textoEditado)`
- **Comportamiento**: llama a `enviarMensaje` con `textoEditado`, guarda `respuestaEditada`, marca `estado: EDITADA_Y_ENVIADA` (FR-012).

### `descartarRespuestaPendiente(id)`
- **Comportamiento**: marca `estado: DESCARTADA`, no envía nada.

### `guardarAutonomiaIntencionConfig(agenteIAConfigId, filas)` — gestión de la Historia 1
- **Input**: `Array<{ categoria: CategoriaIntencionAutonomia; nivel: NivelAutonomia; condicionesConfianza?: {...} }>`
- **Comportamiento**: upsert por `[agenteIAConfigId, categoria]`; cambiar el nivel de una categoría **no** toca ninguna `RespuestaPendienteRevision` ya existente (FR-013).
