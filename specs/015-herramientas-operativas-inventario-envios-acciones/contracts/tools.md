# Contratos: Tools operativas nuevas (`src/ai/tools/providers/`)

Todas siguen el contrato `IProveedorTool` ya existente (`src/ai/tools/types.ts`): `name`, `definition` (JSON schema para el LLM), `execute(args, ctx: ContextoTool): Promise<ResultadoTool>`, validando `ctx.instanciaId` (nunca de `args`) antes de cualquier query — mismo patrón que `buscar_productos`/`obtener_info_cliente` ya existentes.

## `consultar_disponibilidad`
- **Input**: `{ productoId: string }`
- **Output**: `{ disponible: boolean; cantidadDisponible: number | null; manejaStock: boolean }` — `cantidadDisponible: null` cuando `manejaStock: false` (Escenario 3 de la spec).

## `consultar_precio_actual`
- **Input**: `{ productoId: string }`
- **Output**: `{ precio: number; moneda: string }`

## `consultar_promociones`
- **Input**: `{ productoId: string }`
- **Output**: `{ tienePromocion: false; mensaje: "Sin promociones configuradas" }` (research.md Decisión 4 — siempre este resultado por ahora)

## `validar_combinacion_productos`
- **Input**: `{ productoIds: string[] }`
- **Output**: `{ valida: boolean; motivo?: string; advertenciaTipoMixto?: boolean }` (research.md Decisión 2)

## `obtener_metodos_entrega`
- **Input**: `{}`
- **Output**: `{ metodos: Array<{ metodoEntrega: string; costoBase: number; diasEstimadosMin: number | null; diasEstimadosMax: number | null }> }` — lista vacía + `{ mensaje: "Sin métodos de entrega configurados" }` si no hay configuración (FR-008).

## `calcular_costo_envio`
- **Input**: `{ metodoEntrega: string; zona: string }`
- **Output**: `{ costo: number; cubierto: boolean } | { cubierto: false; mensaje: string }` — suma `costoBase + costoAdicional` de `ZonaCoberturaMetodo` si `cubierta: true`; si la zona no está configurada para ese método, `cubierto: false`.

## `estimar_fecha_entrega`
- **Input**: `{ metodoEntrega: string; zona?: string }`
- **Output**: `{ diasMin: number; diasMax: number } | { mensaje: string }` — suma `diasAdicionales` de la zona si aplica.

## `validar_cobertura`
- **Input**: `{ zona: string; metodoEntrega?: string }`
- **Output**: `{ cubierta: boolean; metodosQueCubren: string[] }`

## `obtener_ubicaciones_retiro`
- **Input**: `{}`
- **Output**: `{ ubicaciones: Array<{ nombre: string; direccion: string }> }` — vacío + mensaje si no hay ninguna activa.

## `agregar_productos_oportunidad`
- **Input**: `{ oportunidadId: string; productos: Array<{ productoId: string; cantidad: number }> }`
- **Output**: `{ ok: true; productosAgregados: number } | { ok: false; error: string }`
- **Comportamiento**: reutiliza el caso de uso/validaciones ya existentes de Sales para asociar productos a una oportunidad (mismas reglas que cuando lo hace un humano desde la UI) — la tool es un adaptador hacia ese caso de uso, no una reimplementación (FR-012).

## `crear_cotizacion` (modificado)
- **Cambio de contrato**: el `output` gana `generadoPorIA: true` y `pendienteConfirmacion: boolean` (= `!AgenteIAConfig.accionesComercialesModoBorrador` negado, es decir `true` solo cuando el modo está activo). El mensaje de éxito hacia el cliente distingue ambos casos: con el modo activo, indica que la cotización quedará sujeta a confirmación; sin el modo activo (default), el mensaje es idéntico al actual.
- **Sin cambios**: el resto de la lógica de cálculo de líneas/totales ya existente.

## `crear_pedido` (modificado)
- Mismo criterio que `crear_cotizacion`.

## `confirmarDocumentoIA` — Server Action nueva (no es una tool de IA, es una acción humana)
- **Input**: `{ tipo: "COTIZACION" | "PEDIDO"; id: string }`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: setea `confirmadoPorHumano: true, confirmadoPorUsuarioId: sesion.usuarioId` — falla si el documento no pertenece a la instancia del usuario o si ya estaba confirmado (idempotente: confirmar dos veces no es un error, es un no-op exitoso).

## `src/configuracion/entregas/actions.ts` — configuración (FR-005, FR-006)

- `guardarMetodoEntregaConfig(datos)` / `listarMetodosEntregaConfig()`
- `guardarZonaCobertura(datos)` / `listarZonasCobertura()`
- `guardarUbicacionRetiro(datos)` / `listarUbicacionesRetiro()`

Todas scoped a `sesion.instanciaId` + permiso `"ia"` (o el permiso de configuración de ventas ya existente, a decidir en implementación según cuál calce mejor con `verificarAcceso`).
