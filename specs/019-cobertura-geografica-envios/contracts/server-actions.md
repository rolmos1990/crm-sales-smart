# Contratos: Server Actions

Todas siguen el patrón ya establecido en el proyecto: `'use server'`, Zod al inicio, `requirePermisoAction`/`verificarAcceso` antes de tocar Prisma, `revalidatePath` tras mutar. Ninguna acción existente cambia su firma pública de forma incompatible — se agregan campos opcionales o acciones nuevas.

## `src/sales/transportistas/actions.ts`

### `guardarCoberturaGeografica(datos: unknown): Promise<ResultadoAccion<{ id: string }>>` (nueva)

```ts
{
  transportistaId: string,
  paisId: string,        // se ignora y se fuerza al paisOperacionId de la instancia si modoGeografico = UN_SOLO_PAIS
  estadoProvinciaId: string,
  costoEnvio: number,     // >= 0
  activo?: boolean,       // default true
}
```

Valida que `transportistaId` pertenezca a la instancia (`instanciaId` del session), que `estadoProvinciaId` pertenezca a `paisId`, y hace `upsert` por `(transportistaId, estadoProvinciaId)` — permite editar el costo de una zona ya cargada sin duplicar filas.

### `eliminarCoberturaGeografica(id: string): Promise<ResultadoAccion>` (nueva)

Borra una fila de `TransportistaCoberturaGeografica`, validando que pertenezca a un transportista de la instancia actual.

### `crearTransportista` / `editarTransportista` (existentes)

Sin cambios de firma — la cobertura geográfica se gestiona con las acciones nuevas de arriba, no como parte del payload de creación/edición del transportista (evita un payload gigante y permite agregar/quitar zonas sin reenviar todo el transportista).

## `src/configuracion/entregas/actions.ts`

### `guardarMetodoEntregaConfig` (existente)

`MetodoEntregaConfigSchema` agrega `modoCobertura: z.enum(["TODOS_LADOS_CON_EXCEPCIONES", "SOLO_ZONAS_EVALUADAS"]).default("SOLO_ZONAS_EVALUADAS")` — opcional en el input, default server-side igual al de Prisma. El resto de la función no cambia.

### `guardarZonaCoberturaMetodo` (existente)

`ZonaCoberturaMetodoSchema` agrega `esExcepcion: z.boolean().default(false)`. La función agrega la validación de FR-007 antes del `upsert`:

```ts
if (validado.data.esExcepcion && validado.data.cubierta) {
  return { exito: false, error: "Una zona no puede ser cobertura y excepción a la vez" };
}
```

### `guardarConfiguracionGeografica(datos: unknown): Promise<ResultadoAccion>` (nueva, vive en `src/configuracion/empresa/actions.ts` junto a la configuración de empresa existente)

```ts
{ modoGeografico: "UN_SOLO_PAIS" | "MULTIPAIS", paisOperacionId?: string }
```

Requiere `paisOperacionId` cuando `modoGeografico = "UN_SOLO_PAIS"` (validación Zod con `.refine`). Actualiza `ConfiguracionEmpresa` de la instancia (`upsert` por `instanciaId`, mismo patrón que el resto de esa configuración).

## `src/sales/cotizaciones/actions.ts` y `src/sales/pedidos/actions.ts`

Los schemas de entrega (`EntregaCotizacionSchema`, y el equivalente en pedidos) agregan `paisId`, `estadoProvinciaId`, `ciudad` opcionales — sin required nuevos, para no romper ningún flujo existente que hoy no los envía. Las acciones de guardado (`guardarCotizacion`/`actualizarEntregaPedido`, etc.) simplemente persisten estos campos si vienen, igual que ya hacen con `transportistaId`.

## Query nueva de soporte (no es Server Action, es lectura para prellenar UI)

### `obtenerCostoSugerido(input): Promise<{ costo: number; cubierto: boolean; ambiguo: boolean } | null>`

Vive en `src/configuracion/entregas/queries.ts` (o un nuevo `src/shared/entregas/resolver-costo.ts` si se comparte con las tools de IA — preferible, para no duplicar el flujo de resolución de `data-model.md`). La usan `form-cotizacion.tsx`/`form-entrega.tsx` para prellenar `costoEnvio` cuando el usuario elige país/estado/ciudad + transportista — el usuario humano siempre puede sobrescribir el valor sugerido a mano (a diferencia del agente de IA, que nunca debe inventar uno).

**Decisión de reutilización**: el flujo de resolución de costo descrito en `data-model.md` se implementa una sola vez (`src/shared/entregas/resolver-costo-envio.ts`, función pura + una capa de acceso a datos) y lo consumen tanto las tools de IA (`calcular_costo_envio`, `validar_cobertura`, `estimar_fecha_entrega`) como esta query de UI — evita que la lógica de "qué cuenta como coincidencia clara" viva duplicada en dos lugares que podrían desincronizarse.
