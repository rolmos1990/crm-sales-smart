# Contratos: Playbooks de estrategia comercial

## `src/ai/estrategia/actions.ts` (Server Actions, `'use server'`, scoped a `sesion.instanciaId` + permiso `"ia"`)

### `crearEstrategia(datos)`
- **Input**: `{ nombre: string; descripcion?: string; contenido: { reglas: string[] }; condiciones: CondicionesInput; prioridad?: number }`
- **Output**: `{ exito: true; id: string } | { exito: false; error: string }`
- **Comportamiento**: crea con `origen: "PERSONALIZADA"`, `activo: false` (FR-010).

### `editarEstrategia(id, datos)`
- **Input**: igual shape que `crearEstrategia`, `id: string`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: permite editar plantillas también (FR-004) — no distingue por `origen` para edición, solo para el label visual en la UI.

### `activarEstrategia(id)` / `desactivarEstrategia(id)`
- **Input**: `id: string`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: `desactivarEstrategia` no elimina asignaciones existentes — deja de calificar en `seleccionarEstrategia` porque el query de estrategias asignadas filtra por `activo: true` (FR-002, Edge Case "desactivar en curso").

### `duplicarEstrategia(id)`
- **Input**: `id: string`
- **Output**: `{ exito: true; nuevoId: string } | { exito: false; error: string }`
- **Comportamiento**: copia `contenido`/`condiciones`/`prioridad`, fuerza `origen: "PERSONALIZADA"` y `activo: false` en la copia (FR-003).

### `eliminarEstrategia(id)`
- **Input**: `id: string`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: falla con `"No se puede eliminar: está asignada a N agente(s). Quitá la asignación primero."` si existen filas en `AgentePlaybookAsignacion` (FR-011) — la UI ofrece el atajo de quitar asignaciones y reintentar, no lo hace implícito.

### `asignarEstrategiaAAgente(agenteIAConfigId, playbookEstrategiaId, opciones?)`
- **Input**: `{ agenteIAConfigId: string; playbookEstrategiaId: string; prioridadEfectiva?: number; condicionesOverride?: CondicionesInput }`
- **Output**: `{ exito: true; asignacionId: string } | { exito: false; error: string }`
- **Comportamiento**: rechaza si la estrategia no está `activo: true` (no se puede asignar una inactiva) o si ambos ids no pertenecen a `sesion.instanciaId`.

### `quitarAsignacionEstrategia(asignacionId)`
- **Input**: `asignacionId: string`
- **Output**: `{ exito: true } | { exito: false; error: string }`

### `listarEstrategias()` / `listarAsignacionesDeAgente(agenteIAConfigId)`
- Queries de lectura, scoped a instancia, usadas por la UI de gestión.

## `src/ai/estrategia/selector.ts` — función pura

```ts
interface EstrategiaAsignada {
  playbookEstrategiaId: string;
  nombre: string;
  contenido: { reglas: string[] };
  condiciones: { tiposRelacion: TipoRelacionCliente[]; intenciones: IntencionComercial[] };
  prioridadEfectiva: number;
  asignadaEn: Date; // desempate determinístico en caso de empate de prioridad (research.md Decisión 3)
}

interface SenalesSeleccion {
  tipoRelacion?: TipoRelacionCliente;
  intencion?: IntencionComercial;
}

interface ResultadoSeleccion {
  estrategiaSeleccionada: EstrategiaAsignada | null;
  motivo: string;
  candidatas: number; // cuántas estrategias coincidieron antes de desempatar (Edge Case: >1 se registra)
}

function seleccionarEstrategia(
  estrategiasAsignadas: EstrategiaAsignada[],
  senales: SenalesSeleccion,
): ResultadoSeleccion;
```

- **Comportamiento**: filtra `estrategiasAsignadas` por coincidencia de condiciones (research.md Decisión 3); si ninguna coincide, `estrategiaSeleccionada: null` con motivo explicativo (FR-008); si una o más coinciden, gana la de mayor `prioridadEfectiva`, desempatando por `asignadaEn` descendente.
- **Sin efectos secundarios**: quien la invoque es responsable de persistir el resultado en `SeleccionEstrategiaLog` (FR-009).

## Función de registro — `src/ai/estrategia/registrar-seleccion.ts`

```ts
function registrarSeleccionEstrategia(params: {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId?: string;
  resultado: ResultadoSeleccion;
  senales: SenalesSeleccion;
}): Promise<void>
```

- **Comportamiento**: escribe una fila en `SeleccionEstrategiaLog`. Se llama junto a (pero no bloqueando) el flujo de generación de respuesta — un fallo al escribir el log se captura y loguea a consola, nunca aborta la generación (Constitution III: side effects no bloquean la operación principal).
