# Research: Simulador de agente y experiencia de configuración consolidada

## Decisión 1 — `modoSimulacion` como campo de `ContextoTool`, no una implementación paralela de cada tool

**Decisión**: `ContextoTool` (`src/ai/tools/types.ts`) gana `modoSimulacion?: boolean`. Cada tool que escribe datos agrega, como primera línea de su `execute`, algo equivalente a:

```ts
if (ctx.modoSimulacion) {
  return { ok: true, data: { /* misma forma que el resultado real, con un flag previsualizado: true */ } };
}
```

**Rationale**: reutiliza el 100% de la lógica de cálculo/validación ya existente en cada tool (por ejemplo, `crear_cotizacion` ya calcula subtotales/impuestos antes de escribir — ese cálculo es valioso mostrarlo en la previsualización) sin duplicar esa lógica en un módulo de simulación aparte. Es también la forma más simple de garantizar FR-006/FR-007 con un único punto de control por tool, fácil de testear exhaustivamente (un test por tool que confirma "con `modoSimulacion: true`, cero llamadas a `prisma.create/update/delete`").

**Alternativas consideradas**: un "modo dry-run" a nivel de Prisma (interceptar todas las escrituras de una transacción y hacer rollback) — rechazado por ser mucho más invasivo y riesgoso (requeriría envolver toda la generación de respuesta en una transacción larga, incluyendo la llamada al proveedor de IA, lo cual además viola el principio de no mantener transacciones abiertas durante I/O externo lento); duplicar cada tool en una versión "-simulada.tool.ts" — rechazado por duplicar lógica de cálculo que debe mantenerse sincronizada con el original.

## Decisión 2 — Perfil de cliente simulado reemplaza al de `012`, no lo extiende

**Decisión**: `SimuladorService.ejecutar` arma un `InsumosContexto` (de `013`) donde `perfilCliente` es un objeto `PerfilCliente` construido directamente desde lo que el administrador eligió en la UI (tipo de relación, intención) con el resto de los campos objetivos/interpretados vacíos — nunca llama a `PerfilClienteService.obtenerPerfil` de `012` (que requiere un `contactoId` real).

**Rationale**: es coherente con FR-002 ("sin requerir un contacto real existente") y evita que el simulador dependa de tener contactos de prueba creados en la base de datos real solo para poder simular.

**Alternativas consideradas**: permitir opcionalmente elegir un contacto real existente y usar su perfil real de `012` — se deja como una extensión posible pero no obligatoria de esta spec (no contradice nada del alcance, pero no es parte de los requisitos pedidos explícitamente); el escenario principal y requerido es el cliente 100% simulado.

## Decisión 3 — Dónde vive (o no) el registro de una simulación

**Decisión**: el diagnóstico de una simulación se mantiene en el estado de la sesión de UI del administrador (no persistido) por defecto; se agrega opcionalmente `SimulacionEjecutada` (tabla ligera, `instanciaId`, `agenteIAConfigId`, `escenario: Json`, `resultado: Json`, `creadoEn`) solo si se decide dar valor a un historial de simulaciones pasadas — evaluado como mejora, no como requisito, ya que ningún FR de la spec pide conservar un historial de simulaciones entre sesiones.

**Rationale**: cumple la Assumption de la spec (no mezclar con `UsoIA`/`RespuestaPendienteRevision` reales) de la forma más simple — no persistir nada es la opción más segura por defecto; la tabla opcional queda documentada para no bloquear una futura necesidad sin tener que rediseñar nada.

**Alternativas consideradas**: reutilizar `RespuestaPendienteRevision` de `016`/`017` con un flag `esSimulacion: true` — rechazado explícitamente porque esa tabla alimenta la bandeja de revisión real y el análisis de correcciones de `014`/`017`; mezclar datos simulados ahí, aunque sea con un flag, es un riesgo de contaminación de datos de aprendizaje real que la propia spec prohíbe en su Assumption.

## Decisión 4 — Comparación de versión publicada vs. borrador (Historia 3)

**Decisión**: `SimuladorService.ejecutar` acepta `usarBorrador: boolean`; cuando es `true`, resuelve la configuración del agente desde la fila `AgenteIAConfigVersion` con `estado: BORRADOR` (`009`) en vez de la vigente publicada (`AgenteIAConfig`). El "modo comparar" de la UI simplemente ejecuta `ejecutar` dos veces (una con `false`, otra con `true`) para el mismo mensaje y muestra ambos resultados lado a lado.

**Rationale**: no requiere ningún cambio a `009` — ya expone la fila de borrador vía `listarVersionesAgenteIA`; el simulador solo necesita leer su `contenido` en vez de la fila viva.

**Alternativas consideradas**: publicar temporalmente el borrador, simular, y revertir — rechazado por ser innecesariamente riesgoso (una publicación real, aunque sea temporal, es visible para el resto del sistema) frente a simplemente leer el contenido del borrador sin publicarlo.

## Decisión 5 — Degradación explícita cuando una spec previa aún no existe

**Decisión**: `panel-simulador.tsx` renderiza cada sección del diagnóstico (perfil, estrategia, ejemplos, herramientas, autonomía, registro) de forma condicional a que el módulo correspondiente esté disponible — en la práctica, como todas las specs de `009` a `017` se planean implementar en orden antes de esta, se espera que todas estén presentes; el diseño solo documenta el criterio de "si faltara alguna, se omite esa sección, nunca se simula con datos inventados" como salvaguarda, no como el camino esperado de implementación.

**Rationale**: cumple la Assumption final de la spec sin sobre-diseñar una compatibilidad hacia atrás que, en la práctica, no debería ejercitarse si el plan de 10 specs se ejecuta en el orden acordado.
