# Contratos: tool de IA `consultar_opciones_envio` (implementación) + niveles de confianza

Este contrato **implementa** y **extiende** el ya documentado en [specs/022-transportistas-zonas-tarifas/contracts/ai-tools.md](../../022-transportistas-zonas-tarifas/contracts/ai-tools.md) (nunca implementado hasta este spec), agregando el campo `confianza` que requiere FR-006/FR-007. Sigue el mismo patrón `IProveedorTool`/`registroHerramientas` que `src/ai/tools/providers/calcular-costo-envio.tool.ts` — sin infraestructura MCP externa. Nada de lo expuesto aquí incluye IDs internos de base de datos, teléfono, correo, persona de contacto o notas internas del transportista, ni costo interno/margen (FR-009) — regla verificada construyendo la respuesta campo por campo, nunca por `spread` del objeto interno.

## `consultar_opciones_envio`

**Archivo**: `src/ai/tools/providers/consultar-opciones-envio.tool.ts`

**input_schema**:

```json
{
  "pais": { "type": "string", "description": "Nombre del país — opcional si el negocio opera en un solo país" },
  "provinciaEstado": { "type": "string", "description": "Nombre de la provincia/estado de destino" },
  "distritoCiudad": { "type": "string", "description": "Opcional — refina la coincidencia" },
  "corregimiento": { "type": "string", "description": "Opcional — refina la coincidencia" }
}
```

`required: []` — mismo criterio que el contrato original: mientras menos precisión, más zonas amplias pueden coincidir.

### Respuesta — coincidencia encontrada

```json
{
  "ok": true,
  "data": {
    "confianza": "EXACTA",
    "opciones": [
      {
        "transportista": "UnoExpress",
        "servicio": "Estándar",
        "zona": "Panamá Centro",
        "precio": 5.00,
        "tiempoEstimado": "1 día",
        "aceptaPagoContraEntrega": false,
        "diasEntrega": ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB"],
        "horaLimiteMismoDia": "11:00",
        "confianza": "EXACTA"
      }
    ]
  }
}
```

- `confianza` (nivel de la respuesta): `"EXACTA" | "ALIAS" | "PROBABLE" | "AMBIGUA" | "SIN_COINCIDENCIA"` — ver [research.md §4](../research.md#4-algoritmo-de-matching-con-niveles-de-confianza) para cómo se calcula.
- `opciones[].confianza`: nivel de esa opción puntual (una zona puede coincidir con distinta confianza que otra dentro de la misma respuesta).
- `opciones` ordenadas de menor a mayor `precio` (mismo criterio que la UI humana y que el contrato original).
- `transportista` es el **nombre público** (`Transportista.nombre`), nunca su `id`.
- Cuando `confianza !== "EXACTA"`, se agrega `mensaje` con una aclaración en lenguaje natural para que el agente la traslade al cliente (ej. pedir confirmación de zona).

### Respuesta — ambigua (2+ destinos distintos, ninguno EXACTA/ALIAS)

```json
{
  "ok": true,
  "data": {
    "confianza": "AMBIGUA",
    "opciones": [ /* todas las opciones candidatas, cada una con su confianza PROBABLE */ ],
    "mensaje": "Encontré más de una ubicación posible para lo que escribiste. ¿Podés confirmar la provincia o el distrito?"
  }
}
```

La tool **no descarta** las opciones candidatas en el caso ambiguo — las devuelve igual, con la bandera, para que el agente pueda presentarlas como alternativas si lo considera útil (FR-007), en vez de forzar una segunda consulta.

### Respuesta — sin ninguna coincidencia

```json
{ "ok": true, "data": { "confianza": "SIN_COINCIDENCIA", "opciones": [], "mensaje": "No hay transportistas configurados para ese destino — costo de entrega por confirmar." } }
```

### Diferencia deliberada con `calcular_costo_envio`/`validar_cobertura`/`estimar_fecha_entrega`

Esta tool **no escala a humano** ante múltiples opciones ni ante coincidencia aproximada — ese es su propósito (FR-008): dar al agente la lista completa, con su nivel de confianza, para que compare o pida precisión él mismo. Las tres tools de spec 019 **no cambian** (FR-010): siguen resolviendo solo por coincidencia exacta y escalando a humano ante cualquier ambigüedad — se logra pasando `incluirAliasYAproximado: false` (su valor por defecto) al motor compartido.

## Dependencia de disponibilidad en runtime

`consultar_opciones_envio` se registra en `src/ai/tools/inicializar.ts` igual que las demás, pero **además** requiere el fix descrito en [research.md §6](../research.md#6-dependencia-bloqueante-herramientas-siempre-disponibles-nunca-llegan-a-runtime): sin unificar `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES` y unirla a `herramientasPermitidas` en `generar-respuesta-ia.suscriptor.ts`, la tool queda registrada pero el LLM nunca la puede invocar (FR-011). Este fix es parte del contrato de "disponibilidad", no un detalle interno separable.

## Transportistas de flota propia / mensajero independiente

Sin cambios respecto al contrato original — `consultar_opciones_envio` los resuelve igual (por zona y precio); `TipoTransportista` sigue siendo solo informativo, no cambia cómo se buscan sus tarifas.
