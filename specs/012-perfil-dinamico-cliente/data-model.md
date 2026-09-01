# Data Model: Perfil dinámico del cliente

## `PerfilClienteSnapshot` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `contactoId` | `String @unique` | FK a `Contacto`, `onDelete: Cascade` — un snapshot vigente por contacto (se reemplaza, no se versiona; a diferencia de `009`, aquí no hace falta historial). |
| `instanciaId` | `String` | Índice de aislamiento, denormalizado de `Contacto.instanciaId`. |
| `tipoRelacion` | `String` | Uno de `TipoRelacionCliente` (`src/ai/estrategia/tipos.ts`, definido en `011`). |
| `datosObjetivos` | `Json` | Shape `DatosObjetivos` (ver abajo). |
| `datosInterpretados` | `Json?` | Shape `DatosInterpretados` (ver abajo); `null` si nunca se pudo calcular (FR-007). |
| `senalesObjetivas` | `Json` | `string[]` generadas por plantilla (research.md Decisión 3). |
| `calculadoEn` | `DateTime @default(now())` | Última vez que se recalculó. |
| `disparadoPor` | `String?` | Nombre del evento que disparó este cálculo (auditoría/debug — ej. `"PEDIDO_ENTREGADO"`), `null` si fue el primer cálculo bajo demanda. |

Índices: `@@index([instanciaId])`.

### `DatosObjetivos` (shape de `datosObjetivos`)

```ts
interface DatosObjetivos {
  numeroPedidosCompletados: number;
  fechaPrimeraInteraccion: string; // ISO date
  fechaUltimaCompra: string | null;
  productosComprados: Array<{ productoId: string; nombre: string }>;
  oportunidadesAbiertas: Array<{ id: string; titulo: string; etapa: string }>;
  cotizacionesActivas: Array<{ id: string; numero: string; estado: string }>;
  incidenciasActivas: number; // conversaciones con clasificacion = SOPORTE sin resolver
  metodoEntregaHabitual: string | null; // MetodoEntrega más frecuente entre pedidos/cotizaciones históricos
}
```

### `DatosInterpretados` (shape de `datosInterpretados`, siempre marcado como interpretado)

```ts
interface DatosInterpretados {
  intencionComercialActual: IntencionComercial | null;
  productosConsultados: string[]; // nombres/términos mencionados, best-effort
  preferenciasIdentificadas: string[];
  presupuestoConocido: string | null; // texto libre normalizado, ej. "hasta $500"
  ocasionActual: string | null;
  fechaRequerida: string | null; // ISO date si se pudo extraer
  confianza: number; // 0-1, heurística de la propia extracción
  extraidoEn: string; // ISO datetime — cuándo se generó esta interpretación puntual
}
```

## Relación con entidades existentes

```text
Contacto 1───1 PerfilClienteSnapshot
   │
   ├── Pedido[]          (lectura — numeroPedidosCompletados, fechaUltimaCompra, productosComprados, metodoEntregaHabitual)
   ├── Cotizacion[]       (lectura — cotizacionesActivas, metodoEntregaHabitual)
   ├── OportunidadContacto[] → Oportunidad  (lectura — oportunidadesAbiertas, mismo criterio que customer.tool.ts:
   │                                          fechaGanada=null AND fechaPerdida=null)
   └── Conversacion[]     (lectura — incidenciasActivas por clasificacion=SOPORTE; disparador de extracción interpretada)

Eventos de dominio (ya existentes, ver research.md Decisión 1) ──> invalidar-perfil.suscriptor.ts ──> recalcula PerfilClienteSnapshot
ConversacionClasificada (nuevo, research.md Decisión 5) ──────────┘
```

Ninguna tabla existente cambia de forma. `PerfilClienteSnapshot` es puramente aditivo.
