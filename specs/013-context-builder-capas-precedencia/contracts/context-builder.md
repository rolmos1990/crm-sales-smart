# Contratos: `src/ai/contexto/context-builder.ts`

## `construirContextoCompuesto(insumos)`

```ts
async function construirContextoCompuesto(insumos: InsumosContexto): Promise<ContextoCompuesto>
```

- **Comportamiento**: ejecuta las 11 capas en orden de `precedencia` ascendente (research.md Decisión 2). La capa 5 (perfil) se ejecuta antes que la capa 4 (estrategia) en términos de *cálculo* (para poblar `insumos.perfilCliente` con las señales que el selector necesita), pero el *texto* de la capa 4 se posiciona antes que el de la capa 5 en `systemPrompt` final (la precedencia de contenido, no el orden de cómputo, es lo que importa para FR-002/FR-006). Cada capa que devuelve `null` se omite sin dejar rastro en el texto (FR-003).
- **Tolerancia a fallos**: si `seleccionarEstrategia` (capa 4) o `PerfilClienteService.obtenerPerfil` (capa 5) lanzan una excepción o no tienen datos, se tratan como `null` para esa capa — nunca abortan la construcción de las demás capas (FR-009).

## `construirSystemPrompt(config, ctx?)` — firma pública sin cambios (compat con `009`)

Internamente delega en `construirContextoCompuesto` con `conversacionId`/`contactoId` ausentes cuando se llama en el modo "solo prompt de agente" (por ejemplo, desde la UI de configuración de `009` para previsualizar). Devuelve `resultado.systemPrompt`.

## `construirContexto(opciones)` — firma pública sin cambios (compat con consumidores actuales)

Internamente delega en `construirContextoCompuesto` con todos los insumos disponibles (`conversacionId`, `contactoId`, `oportunidadId`). El `ContextoIA` que devuelve hoy (`sistemaPrompt`, `conversacion`, `contacto`, `oportunidad`) se sigue devolviendo igual; se agrega opcionalmente la metadata de `estrategiaSeleccionada`/`perfilClienteUsado` como campos nuevos opcionales de `ContextoIA` (aditivo, no rompe a quien ya lo consume sin leer esos campos).

## Capas — contrato de cada función productora (`src/ai/contexto/capas/*.ts`)

Todas siguen la misma firma `(insumos: InsumosContexto) => Promise<string | null>`. Ejemplo concreto:

```ts
// estrategia-activa.ts
export async function producirCapaEstrategia(insumos: InsumosContexto): Promise<string | null> {
  if (!insumos.agenteIAConfigId) return null;
  const asignadas = await listarAsignacionesDeAgente(insumos.agenteIAConfigId);
  if (asignadas.length === 0) return null;
  const resultado = seleccionarEstrategia(asignadas, {
    tipoRelacion: insumos.perfilCliente?.tipoRelacion,
    intencion: insumos.perfilCliente?.datosInterpretados?.intencionComercialActual ?? undefined,
  });
  await registrarSeleccionEstrategia({ /* ... */ resultado, /* ... */ });
  if (!resultado.estrategiaSeleccionada) return null;
  return `Estrategia activa para esta conversación (${resultado.estrategiaSeleccionada.nombre}):\n` +
    resultado.estrategiaSeleccionada.contenido.reglas.map((r) => `- ${r}`).join("\n");
}
```

## Placeholders (capas 7, 8, 9) — contrato mínimo

```ts
// datos-conocidos-faltantes.ts / info-operativa.ts / ejemplos-piloto.ts
export async function producirCapa_X(_insumos: InsumosContexto): Promise<string | null> {
  return null; // reservado para spec futura — ver research.md Decisión 1
}
```

Cada placeholder lleva un comentario apuntando a la spec que lo completará (`014` o `015`), para que quien la implemente encuentre el punto de extensión sin tener que releer esta spec completa.
