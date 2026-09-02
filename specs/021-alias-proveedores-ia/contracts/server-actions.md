# Contratos: Server Actions — `src/configuracion/ia/actions.ts`

Todas las acciones siguen el patrón ya existente en el módulo: `requireSesion()` → `verificarAcceso(sesion, "ia", "modificar")` → validar con Zod → verificar tenencia (`instanciaId`) → mutar → `revalidatePath("/configuracion")` → devolver `{ exito: boolean, error?: string }`.

## `crearProveedorIA(datos: unknown)` — modificada

**Input** (`ProveedorIASchema` extendido, `src/configuracion/ia/schema.ts`):

```ts
{
  alias: string;            // NUEVO — obligatorio, trim, 1-50 caracteres
  proveedor: "ANTHROPIC" | "OPENAI" | "GEMINI" | "DEEPSEEK" | "NVIDIA" | "LOCAL";
  tipoAgenteIA?: "COMERCIAL" | "GERENCIA" | null;
  apiKey?: string;
  baseUrl?: string;
  modelosDisponibles: string; // CSV, sin cambios
  prioridad: number;          // 1-10
  limitePorMinuto?: number | null;
  limitePorDia?: number | null;
  timeoutMs: number;
  reintentosMax: number;
}
```

**Comportamiento nuevo**:
1. Antes del `create`, normaliza `aliasNormalizado = alias.trim().toLowerCase()`.
2. Verifica que no exista otro `ProveedorIA` de la misma `instanciaId` con el mismo `aliasNormalizado` (`findFirst`). Si existe: `{ exito: false, error: "Ya existe un agente con el alias \"<alias>\"" }` — no llega a Prisma `create`.
3. Ya **no** puede fallar por la restricción vieja `(proveedor, tipoAgenteIA)` — esa restricción se elimina (FR-002).
4. Si el `create` igual choca contra el `@@unique([instanciaId, aliasNormalizado])` (condición de carrera), captura `Prisma.PrismaClientKnownRequestError` con `code === "P2002"` y devuelve el mismo mensaje de alias duplicado, nunca el error crudo de Prisma.

**Output sin cambios**: `{ exito: true }` | `{ exito: false, error: string }`.

---

## `actualizarProveedorIA(id: string, datos: unknown)` — NUEVA (FR-006, FR-007)

**Input**: mismo shape que `crearProveedorIA` salvo que **no** incluye `proveedor` (inmutable, Decisión 5 de research.md) — se valida con un nuevo `ActualizarProveedorIASchema = ProveedorIASchema.omit({ proveedor: true })`.

```ts
actualizarProveedorIA(id: string, datos: unknown): Promise<{ exito: boolean; error?: string }>
```

**Precondiciones**:
- `verificarAcceso(sesion, "ia", "modificar")`.
- `prisma.proveedorIA.findFirst({ where: { id, instanciaId: sesion.instanciaId } })` debe existir — mismo patrón de tenencia que `toggleProveedorIA`/`eliminarProveedorIA`. Si no existe: `{ exito: false, error: "Proveedor no encontrado" }`.

**Comportamiento**:
1. Valida `datos` con `ActualizarProveedorIASchema`. Si falla: `{ exito: false, error: "Datos inválidos" }`.
2. Normaliza `aliasNormalizado = datos.alias.trim().toLowerCase()`.
3. Verifica duplicado **excluyendo el propio registro**: `findFirst({ where: { instanciaId, aliasNormalizado, NOT: { id } } })`. Si existe otro: `{ exito: false, error: "Ya existe un agente con el alias \"<alias>\"" }` (FR-005). Guardar el mismo alias que ya tenía el registro (FR-007) pasa esta verificación porque el propio `id` queda excluido.
4. Actualiza los campos editables (todos menos `proveedor`, `id`, `instanciaId`, `creadoEn`).
5. Mismo resguardo `P2002` que en `crearProveedorIA`.
6. `revalidatePath("/configuracion")`.

**Output**: `{ exito: true }` | `{ exito: false, error: string }`.

---

## Acciones sin cambio de contrato (impactadas solo por el nuevo campo)

- `toggleProveedorIA(id, activo)` — sin cambios de firma ni comportamiento.
- `eliminarProveedorIA(id)` — sin cambios de firma ni comportamiento.
- `guardarAsignacionesObjetivoIA(datos)` — sin cambios de firma; sigue operando por `proveedorIAId`, nunca por alias (el alias es solo de presentación, ver data-model.md).

## Contratos de lectura — `src/configuracion/ia/queries.ts`

- `obtenerProveedoresIA(instanciaId)`: el `select` agrega `alias: true`. Shape resultante añade `alias: string` a cada elemento (sin remover ningún campo existente).
- `obtenerProveedorIA(id, instanciaId)`: el `select` agrega `alias: true`.
- `obtenerAsignacionesObjetivoIA(instanciaId)`: el objeto `AsignacionObjetivoIA` agrega `proveedorAlias: string | null` (se mantiene `proveedorNombre` sin remover, para no romper ningún consumidor existente que ya lo lea).

## Errores — reglas transversales (Principio V)

- Ningún mensaje de error expone detalles internos de Prisma (código de error, nombre de constraint, stack). Todo error de duplicado usa el mismo texto de negocio: `Ya existe un agente con el alias "<alias>"`.
- Los mensajes de error genéricos existentes (`"Datos inválidos"`, `"Proveedor no encontrado"`) se mantienen sin cambios para las rutas que no involucran alias.
