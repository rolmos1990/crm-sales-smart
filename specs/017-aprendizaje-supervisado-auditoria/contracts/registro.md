# Contratos: `src/ai/autonomia/registro.ts` y extensiones

## `ensamblarYPersistirRegistro(datos)` (nuevo, reemplaza la llamada directa a `crearRespuestaPendiente` de `016` en ambos caminos)

```ts
interface DatosRegistroRespuesta {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId: string;
  mensajeCliente: string;
  respuestaPropuesta: string;
  estadoInicial: "ENVIADA_AUTOMATICAMENTE" | "PENDIENTE";
  motivoPendiente?: string;      // solo si estadoInicial = PENDIENTE (de 016)
  categoriaDetectada?: CategoriaIntencionAutonomia; // de 016
  usoIAId?: string;
  estrategiaUtilizadaId?: string;
  ejemplosUtilizadosIds?: string[];
  herramientasEjecutadas?: string[];
  confianza?: number;
  motivoTransferencia?: string;
  productoIdentificadoId?: string;
}

async function ensamblarYPersistirRegistro(datos: DatosRegistroRespuesta): Promise<string | null>
```

- **Comportamiento**: crea la fila de `RespuestaPendienteRevision` con todos los campos disponibles. Envuelto en `try/catch` — cualquier error se loguea y devuelve `null`, **nunca** se propaga hacia el suscriptor (FR-010).
- **Uso desde el suscriptor**: se llama tanto en el camino `ENVIAR` (con `estadoInicial: "ENVIADA_AUTOMATICAMENTE"`, después de que `enviarMensaje` ya tuvo éxito) como en el camino `PENDIENTE` (igual que `016`, antes de esperar la acción humana).

## Extensión de `generar-respuesta-ia.suscriptor.ts`

El loop de tool calling ya existente (`ejecutarConTools`) acumula, además del contenido final, `herramientasEjecutadas: string[]` (nombres de cada `llamada.name` ejecutada) y, si `transferir_a_humano` fue una de ellas, su `motivo` — ambos se pasan a `ensamblarYPersistirRegistro`. La resolución de `estrategiaUtilizadaId`/`ejemplosUtilizadosIds` viene de la metadata que `013` ya expone en `ContextoCompuesto` (`estrategiaSeleccionada`, y el equivalente para ejemplos que `014` agrega a esa misma metadata).

## `agregarEvaluacion(respuestaId, calificacion, comentario?)` — Server Action nueva

- **Input**: `{ respuestaId: string; calificacion: "BUENA" | "NECESITA_MEJORA"; comentario?: string }`
- **Output**: `{ exito: true; id: string } | { exito: false; error: string }`
- **Comportamiento**: valida que `respuestaId` pertenece a la instancia de la sesión; crea una fila nueva en `EvaluacionRespuestaIA` (nunca sobrescribe una anterior, research.md Decisión 4).

## `listarRegistrosRespuesta(filtros)` — consulta consolidada (Historia 1, SC-002)

- **Input**: `{ agenteIAConfigId?: string; conversacionId?: string; desde?: Date; hasta?: Date }`
- **Output**: lista de registros con todos los campos propios más, por cada uno, el join resuelto de `UsoIA` (versión/modelo/tiempo/consumo) y sus `EvaluacionRespuestaIA` asociadas — un único objeto por respuesta, sin que el responsable deba cruzar tablas manualmente (SC-002).

## Extensión de `transfer.tool.ts`

Sin cambios en su lógica de negocio (sigue actualizando `Conversacion.clasificacion` igual que hoy) — se agrega que su `execute` devuelva también `motivo` en `ResultadoTool.data` de forma explícita (ya lo hace), y el suscriptor lo captura al procesar `toolResults` para pasarlo a `ensamblarYPersistirRegistro`.

## Extensión de `ejecutarAnalisisPiloto` (`014`)

```ts
async function ejecutarAnalisisPiloto(
  agenteIAConfigId?: string,
  opciones?: { incluirCorreccionesRecientes?: boolean }, // NUEVO
): Promise<{ exito: true; recomendacionesGeneradas: number } | { exito: false; error: string }>
```

- **Comportamiento nuevo**: si `incluirCorreccionesRecientes: true`, agrega al contenido enviado al análisis un resumen de las `RespuestaPendienteRevision` con `estado: "EDITADA_Y_ENVIADA"` recientes (mensaje/propuesta/final), como contexto adicional — el resto del comportamiento de `ejecutarAnalisisPiloto` (produce `RecomendacionComportamiento` en `PENDIENTE`, nunca escribe en `AgenteIAConfig`) no cambia (FR-009).
