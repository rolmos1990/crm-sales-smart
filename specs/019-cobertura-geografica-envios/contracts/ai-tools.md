# Contratos: tools de IA de envío

Las tres tools existentes cambian de forma **compatible hacia atrás en el nombre y el propósito**, pero su `input_schema` y su `data` de respuesta cambian — cualquier prompt/documentación del agente que referencie `zona: string` debe actualizarse (tasks). No se crean tools nuevas: `calcular_costo_envio`, `validar_cobertura` y `estimar_fecha_entrega` se extienden in-place.

Las tres comparten el mismo comportamiento de escalación (research.md Decisión 4/5): cuando el flujo de resolución de costo determina "sin coincidencia clara", la tool misma invoca la transferencia a humano interna y responde con `transferidoAHumano: true` — el LLM nunca recibe un resultado ambiguo que pueda interpretar libremente.

## `calcular_costo_envio`

**input_schema**:

```json
{
  "pais": { "type": "string", "description": "Nombre del país (opcional si el negocio opera en un solo país)" },
  "estadoProvincia": { "type": "string", "description": "Nombre del estado/provincia de destino" },
  "ciudad": { "type": "string", "description": "Opcional — refina la coincidencia" },
  "metodoEntrega": { "type": "string", "description": "Opcional — restringe a un método puntual" },
  "transportistaId": { "type": "string", "description": "Opcional — restringe a un transportista puntual" }
}
```

`required: ["estadoProvincia"]`

**Respuesta — coincidencia clara**:

```json
{ "ok": true, "data": { "cubierto": true, "costo": 25.5, "moneda": "PEN" } }
```

**Respuesta — excepción explícita (clara, no ambigua)**:

```json
{ "ok": true, "data": { "cubierto": false, "mensaje": "Sin cobertura para esa zona (excepción configurada)." } }
```

**Respuesta — sin coincidencia clara (transferido)**:

```json
{
  "ok": true,
  "data": {
    "transferidoAHumano": true,
    "mensaje": "No fue posible determinar un costo de envío exacto para esa ubicación. La conversación fue transferida a un asesor — no informes ningún costo estimado al cliente."
  }
}
```

## `validar_cobertura`

**input_schema**: igual forma que `calcular_costo_envio` sin `metodoEntrega`/`transportistaId` obligatorios (se mantienen como filtros opcionales).

**Respuestas**: mismas tres formas que `calcular_costo_envio`, cambiando `costo` por `metodosQueCubren: string[]` en el caso de coincidencia clara.

## `estimar_fecha_entrega`

**input_schema**: agrega `pais`/`estadoProvincia`/`ciudad` opcionales junto a los ya existentes `metodoEntrega`/`zona` — `zona` se conserva por compatibilidad con el caso "delivery, zona aproximada" (texto libre), la terna país/estado/ciudad aplica al caso "transportista".

**Respuestas**: mismas tres formas, con `diasMin`/`diasMax` en el caso de coincidencia clara.

## Función interna compartida (no es una tool expuesta al LLM)

`src/ai/tools/shared/transferir-a-humano-interno.ts`

```ts
export async function transferirAHumanoInterno(
  ctx: ContextoTool,
  motivo: string,
): Promise<void>
```

Ejecuta exactamente el mismo efecto secundario que hoy tiene `transferir_a_humano.tool.ts` (marcar `Conversacion.clasificacion = SOPORTE`, publicar `EventosSistema.ConversacionClasificada`), respetando `ctx.modoSimulacion` (spec 018 — en simulación no toca Prisma ni publica eventos, solo marca `previsualizado: true` en el resultado de quien la invoque). `transferir_a_humano.tool.ts` se refactoriza para llamar a esta misma función — sin duplicar lógica.
