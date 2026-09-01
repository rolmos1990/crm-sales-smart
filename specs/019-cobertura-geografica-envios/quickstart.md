# Quickstart: validar Cobertura geográfica y costos de envío

Prerequisitos: base de datos migrada (`npm run db:migrate`) y catálogo ISO de país/estado sembrado (`npm run db:seed:geografia` — script idempotente y separado del `db:seed` de datos de ejemplo, ver `data-model.md` "Seed de catálogo"), servidor corriendo (`npm run dev`), sesión de un usuario con permiso `configuracion:modificar`.

## Escenario 1 — Transportista con cobertura por país/estado (User Story 1)

1. Ir a `/sales/transportistas`, crear un transportista (ej. "DHL", tipo `COURIER_EXTERNO`).
2. Editarlo y agregar dos zonas de cobertura usando el selector de país (Combobox con bandera + nombre + código ISO, buscable escribiendo "Per" o "PE" — confirmar que el listado no se limita a LatAm, cualquier país ISO debe aparecer): País = "Perú" / Estado = "Lima" / Costo = 20; País = "Perú" / Estado = "Arequipa" / Costo = 35.
3. Confirmar en la lista que ambas zonas aparecen con su costo.
4. Vía la query/tool `calcular_costo_envio` con `estadoProvincia: "Lima"`, confirmar que devuelve `costo: 20`.
5. Consultar `estadoProvincia: "Cusco"` (sin configurar) y confirmar que la respuesta indica falta de cobertura sin inventar un número — si se invoca como tool de IA, confirmar que `transferidoAHumano: true` y que `Conversacion.clasificacion` pasó a `SOPORTE`.

**Éxito**: coincide con Acceptance Scenarios 1-4 de User Story 1.

## Escenario 2 — Delivery propio con modo de cobertura y excepciones (User Story 2)

1. En `/configuracion` → sección Entregas, configurar el método `MENSAJERO_PROPIO` con `modoCobertura = TODOS_LADOS_CON_EXCEPCIONES`.
2. Agregar zona aproximada "Centro Histórico" marcada como `esExcepcion = true`.
3. Consultar cobertura para "Centro Histórico" → debe responder cubierto = false, de forma clara (sin transferir a humano — es una excepción explícita, no una ambigüedad).
4. Consultar cobertura para "Zona Norte" (no listada) → como el modo es "todos lados con excepciones", debe responder cubierto = true.
5. Cambiar el método a `modoCobertura = SOLO_ZONAS_EVALUADAS` sin agregar ninguna zona cubierta explícita, y repetir la consulta de "Zona Norte" → debe transferir a humano (zona pendiente de evaluación).
6. Intentar guardar la misma zona con `cubierta = true` y `esExcepcion = true` a la vez → la acción debe rechazarlo con error.

**Éxito**: coincide con Acceptance Scenarios 1-6 de User Story 2 y el Edge Case de configuración contradictoria.

## Escenario 3 — El agente escala ante ambigüedad (User Story 3)

1. Configurar dos transportistas distintos con cobertura para el mismo estado/provincia, con costos diferentes, y ningún criterio (método/transportista) en la pregunta para desambiguar.
2. Simular la pregunta del cliente "¿cuánto cuesta el envío a [ese estado]?" contra el agente (o invocar `calcular_costo_envio` directamente con solo `estadoProvincia`).
3. Confirmar que la respuesta trae `transferidoAHumano: true` y que la conversación de prueba quedó clasificada como `SOPORTE` — no debe aparecer ningún costo en la respuesta.
4. Repetir el mismo escenario pero pasando `transportistaId` del transportista deseado → debe resolver sin ambigüedad y devolver el costo exacto de ese transportista.

**Éxito**: coincide con Acceptance Scenarios 2-4 de User Story 3.

## Escenario 4 — Multipaís vs Un solo país (User Story 4)

1. Configurar el negocio como `modoGeografico = UN_SOLO_PAIS`, `paisOperacionId` = Perú.
2. Crear una cotización nueva → confirmar que el formulario de entrega solo pide provincia/estado (y ciudad opcional), sin selector de país.
3. Cambiar el negocio a `modoGeografico = MULTIPAIS`.
4. Crear otra cotización → confirmar que ahora sí aparece el selector de país, y que el de estado/provincia solo lista los estados del país elegido.
5. Confirmar que las zonas de transportista configuradas en el Escenario 1 (todas de "Perú") siguen intactas tras el cambio de modo — no se perdió ningún dato (Edge Case de cambio de modo).

**Éxito**: coincide con Acceptance Scenarios 1-4 de User Story 4 y el Edge Case correspondiente.

## Verificación de no-regresión (fuera de las historias, pero crítico por el pedido de "no romper otras áreas")

- Un negocio que **no** configura ninguna cobertura geográfica nueva sigue pudiendo usar `MetodoEntregaConfig`/`ZonaCoberturaMetodo` (zonas de texto libre) exactamente como antes — correr los tests existentes `calcular-costo-envio.test.ts`, `validar-cobertura.test.ts` (si existe) y confirmar que siguen pasando sin modificación de sus casos previos.
- Crear un pedido a partir de una cotización aprobada (`generar-pedido-desde-cotizacion.service.ts`) y confirmar que, si la cotización tenía país/estado/ciudad cargados, el pedido generado los conserva.
- Confirmar que `transferir_a_humano` invocada directamente por el LLM (motivo distinto a envío) sigue funcionando idéntico (mismo mensaje, mismo evento) tras la extracción a la función interna compartida.
