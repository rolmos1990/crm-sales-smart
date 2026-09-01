# Contratos: tools de IA — opciones de envío por transportista

Sigue exactamente el patrón `IProveedorTool`/`registroHerramientas` ya usado por `src/ai/tools/providers/calcular-costo-envio.tool.ts` — no se introduce infraestructura MCP externa (ver research.md Decisión 4 y Assumptions de spec.md). Nada de lo expuesto aquí incluye IDs internos de base de datos, teléfono, correo, persona de contacto o notas internas del transportista, ni costo interno/margen (FR-059) — regla verificada en cada `execute()`.

## `consultar_opciones_envio` (nueva)

**Cuándo se usa**: únicamente cuando el producto en cuestión requiere envío/transportista físico (`tipoCumplimiento = FISICO`, FR-057) — nunca para `SERVICIO`/`DIGITAL`.

**input_schema**:

```json
{
  "pais": { "type": "string", "description": "Nombre del país — opcional si el negocio opera en un solo país" },
  "provinciaEstado": { "type": "string", "description": "Nombre de la provincia/estado de destino" },
  "distritoCiudad": { "type": "string", "description": "Opcional — refina la coincidencia" },
  "corregimiento": { "type": "string", "description": "Opcional — refina la coincidencia" }
}
```

`required: []` (todos opcionales — mientras menos precisión, más zonas amplias pueden coincidir; sin ningún dato, la tool devuelve las opciones que apliquen sin restricción geográfica, si las hay).

**Respuesta — opciones encontradas**:

```json
{
  "ok": true,
  "data": {
    "opciones": [
      {
        "transportista": "UnoExpress",
        "servicio": "Estándar",
        "zona": "Panamá Centro",
        "precio": 5.00,
        "tiempoEstimado": "1 día",
        "aceptaPagoContraEntrega": false,
        "diasEntrega": ["LUN","MAR","MIE","JUE","VIE","SAB"],
        "horaLimiteMismoDia": "11:00"
      }
    ]
  }
}
```

Ordenadas de menor a mayor precio (mismo criterio que la UI humana, FR-036). El campo `transportista` es el **nombre público** (`Transportista.nombre`), nunca su `id`.

**Respuesta — sin opciones para ese destino**:

```json
{ "ok": true, "data": { "opciones": [], "mensaje": "No hay transportistas configurados para ese destino — costo de entrega por confirmar." } }
```

**Diferencia deliberada con `calcular_costo_envio`/`validar_cobertura`**: esta tool **no escala a humano** ante múltiples opciones — al contrario, ese es su propósito (FR-056, Historia 7): dar al agente la lista completa para que recomiende, tal como lo haría un vendedor humano. `calcular_costo_envio`/`validar_cobertura` siguen escalando ante ambigüedad (comportamiento de spec 019 sin cambios, research.md Decisión 4).

## `calcular_costo_envio` / `validar_cobertura` / `estimar_fecha_entrega` (existentes — adaptadas, sin cambio de contrato externo)

Su `input_schema` y forma de respuesta **no cambian** (siguen documentados en `specs/019-cobertura-geografica-envios/contracts/ai-tools.md`). Internamente, su fuente "Transportista" pasa de consultar `TransportistaCoberturaGeografica`/`EstadoProvincia` a consultar el nuevo modelo de zonas (`obtenerCandidatosEnvioPorZona`, research.md Decisión 4), colapsado igual que antes por `decidirCoincidenciaCosto` sin cambios. El comportamiento observable (incluida la escalación a humano ante ambigüedad) es idéntico al de spec 019.

## Transportistas de flota propia / mensajero independiente

`consultar_opciones_envio` los resuelve exactamente igual (por zona y precio, FR-058) — no hay una tool ni un camino de código separado para ellos; la diferencia de tipo (`TipoTransportista`) es solo informativa en la ficha del transportista, no cambia cómo se buscan sus tarifas por zona.
