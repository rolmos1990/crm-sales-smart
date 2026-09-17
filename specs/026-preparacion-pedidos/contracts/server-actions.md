# Contracts: Server Actions y Queries — Preparación

**Feature**: 026-preparacion-pedidos | **Fecha**: 2026-09-17

Interfaz que el módulo expone a la UI. Sigue los patrones vigentes del proyecto: Server Actions en
`actions.ts` con `'use server'`, validación Zod al inicio, `revalidatePath` tras mutar, y el tipo de retorno
`Resultado<T>` ya usado en `src/sales/flujo-venta/actions.ts:18`.

```ts
type Resultado<T = void> = { exito: true; datos: T } | { exito: false; error: string };
```

Toda acción y toda query MUST resolver `instanciaId` desde la sesión (`requireSesion()`) y acotar la consulta
a esa instancia — nunca aceptar `instanciaId` desde el cliente (constitución V).

---

## Guardas de acceso

```ts
// Lectura del tablero y del chip en pedidos
verificarAcceso(sesion, "preparacion", "ver")

// Mover tarjetas y marcar ítems
verificarAcceso(sesion, "preparacion", "modificar")

// Configurar estados y entradas del tablero
verificarAcceso(sesion, "preparacion", "modificar")
```

El módulo `"preparacion"` es independiente de `"pedidos"`: un rol puede modificar preparación sin poder
modificar pedidos (FR-033).

---

## Queries — `src/sales/preparacion/queries.ts`

### `obtenerTableroPreparacion`

```ts
interface FiltrosTablero {
  rango: "HOY" | "MANANA" | "SEMANA" | "PERSONALIZADO";
  desde?: Date;           // solo con rango PERSONALIZADO
  hasta?: Date;           // solo con rango PERSONALIZADO
  busqueda?: string;      // número de pedido, cliente o producto
  agrupacion?: "POR_PEDIDO" | "POR_PRODUCTO";
}

interface TarjetaPreparacion {
  pedidoId: string;
  numero: string;
  cliente: string;                 // contacto del CRM o comprador del pedido (FR-021)
  fechaEntrega: Date | null;
  etapaVenta: { nombre: string; color: string | null } | null;
  estadoPreparacionId: string;     // el cliente lo devuelve al mover (CAS)
  iniciadaEn: Date | null;
  completadaEn: Date | null;
  asignadaA: string | null;
  lineas: Array<{
    id: string;
    descripcion: string;
    producto: { id: string; nombre: string } | null;
    cantidad: number;
    cantidadPreparada: number;
  }>;
  totalUnidades: number;
  totalProductos: number;
  avanceCompleto: boolean;         // derivado: todas las líneas completas
}

interface ColumnaTablero {
  estado: { id: string; nombre: string; color: string | null; orden: number; esFinal: boolean; marcaInicio: boolean };
  tarjetas: TarjetaPreparacion[];
}

interface Tablero {
  columnas: ColumnaTablero[];
  sinFecha: TarjetaPreparacion[];   // pedidos sin fechaEntrega (FR-019)
  contadores: { hoy: number; manana: number; semana: number };
  configuracion: ConfiguracionPreparacion;
}

function obtenerTableroPreparacion(instanciaId: string, filtros: FiltrosTablero): Promise<Tablero>
```

**Comportamiento**:
- Deriva la pertenencia al tablero por la etapa del pedido (research Decisión 1) y materializa las
  `PreparacionPedido` faltantes de forma idempotente antes de agrupar.
- Excluye pedidos en etapa final o de cancelación (FR-008).
- Los rangos se calculan con `utils/fechas-zona.ts` sobre `fechaEntrega`, en la zona horaria de la instancia.
- `contadores` se calculan sobre los tres rangos fijos, independientes del filtro activo, para que las
  pestañas coincidan con lo que se muestra al seleccionarlas (FR-018).

### `obtenerResumenPorProducto`

```ts
interface ResumenProducto {
  productoId: string | null;
  nombre: string;
  unidadesRequeridas: number;
  unidadesPreparadas: number;
}

function obtenerResumenPorProducto(instanciaId: string, filtros: FiltrosTablero): Promise<ResumenProducto[]>
```

Consolida las líneas de todos los pedidos del rango (FR-031). Las líneas sin producto del catálogo se
agrupan por su descripción.

### `obtenerActividadReciente`

```ts
function obtenerActividadReciente(instanciaId: string, limite?: number): Promise<Array<{
  pedidoNumero: string;
  estadoAnteriorNombre: string | null;
  estadoNombre: string;
  usuarioNombre: string | null;
  creadoEn: Date;
}>>
```

### `obtenerConfiguracionPreparacion`

```ts
interface ConfiguracionPreparacion {
  id: string;
  nombre: string;
  agrupacionDefecto: "POR_PEDIDO" | "POR_PRODUCTO";
  rangoDefecto: "HOY" | "MANANA" | "SEMANA" | "PERSONALIZADO";
  estados: Array<{ id: string; nombre: string; color: string | null; orden: number; esInicial: boolean; marcaInicio: boolean; esFinal: boolean; activo: boolean; pedidosAsignados: number }>;
  etapasEntrada: Array<{ etapaId: string; nombre: string; color: string | null; activa: boolean }>;
  etapasDisponibles: Array<{ id: string; nombre: string; color: string | null }>;
  entradasInvalidas: string[];   // etapas configuradas que ya no existen o están inactivas (FR-009)
}

function obtenerConfiguracionPreparacion(instanciaId: string): Promise<ConfiguracionPreparacion>
```

`pedidosAsignados` permite que la UI deshabilite el borrado y exija estado destino al desactivar (FR-004).

---

## Servicios — `src/sales/preparacion/servicios/`

No son Server Actions: son funciones de servidor reutilizables por queries, actions y (a futuro) el worker.

```ts
// Crea el flujo por defecto con 2 estados si la instancia no tiene ninguno. Idempotente.
function asegurarFlujoPreparacion(instanciaId: string): Promise<ConfiguracionPreparacion>

// Crea la PreparacionPedido del pedido si corresponde y no existe. Idempotente (upsert por pedidoId).
function asegurarPreparacionPedido(pedidoId: string, instanciaId: string): Promise<{ id: string; estadoId: string } | null>

// Motor de transición: sella fechas, registra historial, emite eventos. Usa CAS.
function moverPreparacion(params: {
  pedidoId: string;
  estadoDestinoId: string;
  estadoEsperadoId: string;
  usuarioId: string | null;
  tipo?: "MANUAL" | "AUTOMATICO";
}): Promise<{ ok: true } | { ok: false; motivo: "CONFLICTO" | "ESTADO_INVALIDO" | "NO_ENCONTRADO" }>
```

---

## Server Actions — `src/sales/preparacion/actions.ts`

### Operación del tablero

```ts
// FR-011, FR-012, FR-014, FR-015, FR-016, FR-017
function moverPreparacionAction(
  pedidoId: string,
  estadoDestinoId: string,
  estadoEsperadoId: string,
): Promise<Resultado<void>>
```

`estadoEsperadoId` es el estado que el cliente tenía en pantalla. Si no coincide con el actual, la acción
devuelve `{ exito: false, error: "<mensaje de conflicto>" }` y la UI refresca. No se aplica nada parcialmente.

```ts
// FR-027, FR-028, FR-029
function registrarAvanceLineaAction(
  pedidoLineaId: string,
  cantidadPreparada: number,
): Promise<Resultado<{ avanceCompleto: boolean }>>
```

Valida `0 <= cantidadPreparada <= cantidad` de la línea. Sella `preparadaEn` y `preparadaPorId` cuando la
cantidad pasa a ser mayor que cero; los limpia si vuelve a cero.

```ts
function registrarNotaPreparacionAction(pedidoId: string, notas: string): Promise<Resultado<void>>
```

### Configuración

```ts
// FR-001, FR-002
function crearEstadoPreparacionAction(datos: unknown): Promise<Resultado<{ id: string }>>
function actualizarEstadoPreparacionAction(estadoId: string, datos: unknown): Promise<Resultado<void>>

// FR-004 — falla si el estado tiene pedidos
function eliminarEstadoPreparacionAction(estadoId: string): Promise<Resultado<void>>

// FR-004 — exige destino para migrar los pedidos del estado
function desactivarEstadoPreparacionAction(estadoId: string, estadoDestinoId: string): Promise<Resultado<{ pedidosMigrados: number }>>

// FR-022 — orden de columnas, independiente del orden de las etapas del flujo
function reordenarEstadosPreparacionAction(orden: Array<{ id: string; orden: number }>): Promise<Resultado<void>>

// FR-006 — qué etapas del flujo de venta hacen entrar pedidos
function configurarEtapasEntradaAction(etapaIds: string[]): Promise<Resultado<void>>

// FR-022 — agrupación y rango por defecto
function actualizarPreferenciasTableroAction(datos: unknown): Promise<Resultado<void>>
```

### Revalidación

Toda mutación revalida las rutas afectadas:

| Acción | `revalidatePath` |
|--------|------------------|
| `moverPreparacionAction` | `/sales/preparacion`, `/sales/pedidos`, `/sales/pedidos/[id]` |
| `registrarAvanceLineaAction` | `/sales/preparacion`, `/sales/pedidos/[id]` |
| Acciones de configuración | `/sales/preparacion` |

---

## Esquemas Zod — `src/sales/preparacion/schema.ts`

```ts
const EstadoPreparacionSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
  color: z.string().optional(),
  esInicial: z.boolean().default(false),
  marcaInicio: z.boolean().default(false),
  esFinal: z.boolean().default(false),
});

const AvanceLineaSchema = z.object({
  pedidoLineaId: z.string().min(1),
  cantidadPreparada: z.number().min(0),   // el techo (<= cantidad) se valida contra la línea en servidor
});

const PreferenciasTableroSchema = z.object({
  agrupacionDefecto: z.enum(["POR_PEDIDO", "POR_PRODUCTO"]),
  rangoDefecto: z.enum(["HOY", "MANANA", "SEMANA", "PERSONALIZADO"]),
});
```

Los tipos se derivan con `z.infer<>` (regla 2 del proyecto: nada de `any`).

---

## Contrato de UI en Pedidos

El chip de preparación necesita que el listado traiga la relación. Cambio en
`src/sales/pedidos/queries.ts` (`incluirRelaciones`, línea 6):

```ts
preparacion: {
  select: {
    iniciadaEn: true,
    completadaEn: true,
    estado: { select: { nombre: true, color: true, esFinal: true } },
    asignadaA: { select: { nombre: true } },
  },
},
```

**Regla de no regresión (FR-026)**: `preparacion` es nullable. Si es `null`, la lista y el detalle MUST
renderizar exactamente como hoy — ni chip, ni columna extra, ni espacio reservado.
