# Contratos: `src/ai/piloto/`

## `actions.ts` (Server Actions, scoped a `sesion.instanciaId` + permiso `"ia"`)

### `crearConversacionPiloto(conversacionOrigenId, datos)`
- **Input**: `{ conversacionOrigenId: string; clasificacion: "POSITIVO"|"NEGATIVO"; explicacion: string; intencion?; tipoCliente?; productoId?; playbookEstrategiaId? }`
- **Output**: `{ exito: true; id: string } | { exito: false; error: string }`
- **Comportamiento**: valida que `conversacionOrigenId` pertenece a `instanciaId`; crea con `incluidaEnPerfil: false`, `anonimizadaEn: null`.

### `anonimizarConversacionPiloto(id)`
- **Input**: `id: string`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: carga los mensajes de la `Conversacion` origen y el `Contacto` asociado, aplica `anonimizarContenido` (research.md Decisión 1), persiste `contenidoAnonimizado` y `anonimizadaEn`.

### `incluirEnPerfil(id)` / `excluirDePerfil(id)`
- **Input**: `id: string`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: `incluirEnPerfil` falla con `"Anonimizá la conversación antes de incluirla"` si `anonimizadaEn` es `null` (Edge Case).

### `ejecutarAnalisisPiloto(agenteIAConfigId?)`
- **Input**: `agenteIAConfigId?: string` (si se omite, analiza a nivel de instancia)
- **Output**: `{ exito: true; recomendacionesGeneradas: number } | { exito: false; error: string }`
- **Comportamiento**: toma las `ConversacionPiloto` con `incluidaEnPerfil: true` de la instancia/agente, llama al gateway de IA (`TareaIA.REPORTE`, enrutable por `010`) con el contenido anonimizado + las recomendaciones ya `RECHAZADA` (research.md Decisión 3), parsea el resultado como lista de recomendaciones, y las persiste como `PENDIENTE`. Si no hay conversaciones piloto incluidas o el análisis no encuentra patrones, devuelve `recomendacionesGeneradas: 0` sin error (Edge Case).

### `aprobarRecomendacion(id)` / `rechazarRecomendacion(id)`
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: cambia `estado`; nunca toca `AgenteIAConfig`/`AgenteIAConfigVersion` (FR-008, garantizado por diseño — estas acciones no importan nada de `src/configuracion/ia/`).

### `convertirRecomendacionEnRegla(id)`
- **Output**: `{ exito: true; redirigirA: string } | { exito: false; error: string }` — `redirigirA` es la URL de la sección Reglas de `009` con el texto pre-cargado (research.md Decisión 4); marca `estado: CONVERTIDA_REGLA` solo cuando el administrador efectivamente publica desde ese flujo (no al sólo navegar).

### `convertirRecomendacionEnEjemplo(id)`
- **Output**: `{ exito: true; ejemploId: string } | { exito: false; error: string }`
- **Comportamiento**: crea `EjemploPrompt` a partir de la(s) `ConversacionPiloto` referenciadas en `basadaEnConversacionesPilotoIds`; marca `estado: CONVERTIDA_EJEMPLO`.

### `asociarRecomendacionAEstrategia(id, playbookEstrategiaId)`
- **Output**: `{ exito: true } | { exito: false; error: string }`

## `recuperador-ejemplos.ts` — implementación de `IRecuperadorEjemplos`

Ver `data-model.md` para la interfaz completa. `recuperar(criterios)`:

1. Query `EjemploPrompt` con `instanciaId = criterios.instanciaId`, `activo: true`, y (`agenteIAConfigId = criterios.agenteIAConfigId` OR `agenteIAConfigId: null`) — nunca cruza instancia (FR-012).
2. Excluye los que provienen de una `ConversacionPiloto` con `incluidaEnPerfil: false` o de una `RecomendacionComportamiento` con `estado: RECHAZADA` (FR-013) — join/filtro contra esas tablas.
3. Puntúa por cantidad de campos coincidentes con `criterios` (`intencion`, `tipoCliente`, `playbookEstrategiaId`, `productoId`).
4. Ordena por puntaje descendente, desempata por `calidad` y luego por `creadoEn` descendente.
5. Devuelve los primeros 4 con puntaje > 0, recortado a un mínimo de 2 si hay al menos 2 con puntaje > 0 — si solo hay 1 o 0, devuelve esos (nunca rellena con puntaje 0, FR-011).

## Integración con la capa 9 de `013`

```ts
// src/ai/contexto/capas/ejemplos-piloto.ts (reemplaza el placeholder de 013)
export async function producirCapaEjemplosPiloto(insumos: InsumosContexto): Promise<string | null> {
  if (!insumos.agenteIAConfigId) return null;
  const ejemplos = await recuperadorEjemplos.recuperar({
    instanciaId: insumos.instanciaId,
    agenteIAConfigId: insumos.agenteIAConfigId,
    intencion: insumos.perfilCliente?.datosInterpretados?.intencionComercialActual ?? undefined,
    tipoCliente: insumos.perfilCliente?.tipoRelacion,
    // playbookEstrategiaId y productoId se toman de insumos si 013/011 los exponen en ese punto
  });
  if (ejemplos.length === 0) return null;
  return "Ejemplos de referencia de conversaciones anteriores:\n" +
    ejemplos.map((e, i) => `Ejemplo ${i + 1}:\n` + e.contenido.mensajes.map((m) => `${m.rol}: ${m.texto}`).join("\n")).join("\n\n");
}
```
