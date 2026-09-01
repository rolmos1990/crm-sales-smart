# Data Model: Enrutamiento de modelos de IA por objetivo

## `TareaIA` (enum extendido)

Valores existentes sin cambio: `CHAT`, `RESUMEN`, `CLASIFICACION`, `SENTIMIENTO`, `EXTRACCION_ENTIDADES`, `REPORTE`, `EMBEDDINGS`.

Valor nuevo: `IDENTIFICACION_PRODUCTO`.

## `ProveedorIA.casosDeUso` (activado — shape documentado)

Tipo Prisma: `Json?` (sin cambio de columna). Shape de aplicación:

```ts
type CasosDeUsoProveedor = {
  objetivos: Array<TareaIA | "CHAT_RAZONAMIENTO_SUPERIOR">;
};
```

- `objetivos` lista los objetivos para los que este `ProveedorIA` es el asignado en su instancia.
- `"CHAT_RAZONAMIENTO_SUPERIOR"` es un pseudo-objetivo (no forma parte del enum `TareaIA` de Prisma, solo del shape de `casosDeUso`) que representa "conversación que requiere mayor razonamiento" — distinto de `CHAT` estándar.
- Invariante de aplicación (validada en el Server Action, no en la base de datos): dentro de una misma instancia, un mismo objetivo no debería aparecer en el `casosDeUso` de más de un `ProveedorIA` activo a la vez — si ocurre (por edición manual o dato heredado), `resolverProveedorPorObjetivo` toma el de mayor `prioridad` entre los que coincidan, sin error.

## `SolicitudIA` / `SolicitudConHerramientas` (extendidas)

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `requiereRazonamientoSuperior` | `boolean?` | Solo tiene efecto cuando `tarea === "CHAT"` (FR-006). Ausente/`false` para cualquier llamador que no lo pase explícitamente — preserva comportamiento actual. |

## Función de resolución (contrato interno, detallado en `contracts/`)

```text
resolverProveedorPorObjetivo(instanciaId, tarea, requiereRazonamientoSuperior?)
  → ProveedorIA | null   // null si no hay asignación explícita → el llamador cae al criterio actual
```

## Relación con entidades existentes

```text
Instancia 1───N ProveedorIA (activo=true, casosDeUso: { objetivos: [...] })
                    ▲
                    │ resuelto por objetivo (nuevo) o por tipoAgenteIA + prioridad (existente, fallback)
                    │
        SolicitudIA { tarea: TareaIA, requiereRazonamientoSuperior?: boolean }
                    │
                    ▼
                 UsoIA { tarea, proveedorIAId, modelo, ... }  ← ya registra objetivo y proveedor usado (FR-009,
                                                                  sin cambio de schema, solo de qué proveedor llega)
```

Ninguna tabla nueva. `UsoIA.tarea` y `UsoIA.proveedorIAId` ya existen y ya son suficientes para SC-004 ("identificar objetivo y proveedor en menos de 3 pasos") una vez que el enrutamiento real está en efecto.

## Validación (Zod, `configuracion/ia/schema.ts`)

```ts
const ObjetivoEnrutamientoSchema = z.enum([
  "CLASIFICACION", "EXTRACCION_ENTIDADES", "RESUMEN", "IDENTIFICACION_PRODUCTO",
  "SENTIMIENTO", "CHAT", "CHAT_RAZONAMIENTO_SUPERIOR",
]);

const AsignacionObjetivoIASchema = z.object({
  objetivo: ObjetivoEnrutamientoSchema,
  proveedorIAId: z.string().nullable(), // null = "usar criterio por defecto" (FR-005/FR-010)
});
```

Validación server-side adicional (no expresable en Zod puro, FR-003): `proveedorIAId` debe corresponder a un `ProveedorIA` con `activo = true` e `instanciaId` igual al de la sesión — si no, error de validación antes de persistir.
