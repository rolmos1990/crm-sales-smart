# Quickstart: Validar alias, matching con confianza e importación de destinos

## Prerequisitos

- Migración aplicada: `npm run db:migrate` (agrega `nombreVisible`/`nombreNormalizado` a `ZonaEntregaUbicacion` y el modelo `AliasUbicacion` — ver [data-model.md](data-model.md)).
- Backfill corrido: `npx tsx scripts/backfill-normalizar-ubicaciones.ts` (completa `nombreVisible`/`nombreNormalizado` de destinos ya existentes).
- Transportista con al menos una zona/ubicación/tarifa ya configurada (ver quickstart de `specs/022-transportistas-zonas-tarifas/`) — este feature extiende ese catálogo, no parte de cero.
- Sesión con rol `OWNER` o `ADMIN` (permiso `"transportistas"` en `rw`).

## Escenario 1 — Agregar un alias y que la IA lo reconozca (Historias 1 y 2)

1. En `/sales/transportistas/[id]`, pestaña "Zonas y tarifas", abrir el diálogo de alias de una zona (ej. "La Chorrera") y agregar el alias "Chorrera".
2. **Esperado**: el alias queda visible en la lista de esa ubicación (FR-002); intentar agregar "chorrera " (con espacio y minúscula) como alias de una ubicación distinta → rechazado por duplicado normalizado (FR-003).
3. Invocar la tool `consultar_opciones_envio` (ver [contracts/ai-tools.md](contracts/ai-tools.md)) con `provinciaEstado`/`distritoCiudad` = "Chorrera".
4. **Esperado**: `confianza: "ALIAS"`, con las opciones de envío correctas para "La Chorrera" (FR-005/FR-006).
5. Repetir la consulta escribiendo el nombre oficial exacto pero con tildes/mayúsculas distintas (ej. "LA CHÓRRERA" si aplica) → **Esperado**: `confianza: "EXACTA"` (FR-001).

## Escenario 2 — Comparar opciones de envío sin exponer costo interno (Historia 3)

1. Con dos transportistas configurados con tarifa vigente para el mismo destino, invocar `consultar_opciones_envio` para ese destino.
2. **Esperado**: `opciones` trae ambas, ordenadas de menor a mayor `precio`; ningún campo de la respuesta incluye costo interno, margen, id interno, teléfono, correo o notas internas del transportista (FR-009 — verificar inspeccionando el JSON de respuesta completo).

## Escenario 3 — Ubicación ambigua o sin cobertura (Historia 5)

1. Invocar `consultar_opciones_envio` con un texto de ubicación que no coincide con ningún destino configurado.
2. **Esperado**: `confianza: "SIN_COINCIDENCIA"`, `opciones: []`, con mensaje indicando que debe verificarse cobertura — sin inventar un precio (FR-007).
3. Configurar dos destinos cuyo nombre normalizado sea similar pero no idéntico (ej. "San José" en dos provincias distintas, sin alias que los distinga) e invocar la tool con ese texto ambiguo.
4. **Esperado**: `confianza: "AMBIGUA"`, con las opciones candidatas incluidas pero marcadas como tal, y un mensaje pidiendo precisar la ubicación.

## Escenario 4 — Comportamiento sin cambios de las tools existentes (FR-010)

1. Antes de este cambio, anotar la respuesta de `calcular_costo_envio` para una ubicación que ya coincidía de forma exacta.
2. Después de desplegar este feature, repetir la misma consulta.
3. **Esperado**: respuesta idéntica — sigue resolviendo solo por coincidencia exacta y sigue escalando a un humano ante cualquier ambigüedad, exactamente igual que antes.

## Escenario 5 — Importar un lote de destinos con revisión previa (Historia 4)

1. Desde la pestaña "Zonas y tarifas", "Importar destinos" → subir un CSV con una mezcla de: destinos nuevos, un destino que coincide exacto con uno ya configurado, un destino que coincide de forma aproximada con uno existente (posible duplicado), y una fila cuyo alias coincide con dos destinos distintos ya configurados (alias ambiguo).
2. **Esperado**: el paso de revisión clasifica cada fila correctamente en sus 4 categorías (FR-012); el resumen muestra el conteo de cada una.
3. Intentar confirmar sin resolver la fila de alias ambiguo → **Esperado**: bloqueado (FR-013).
4. Excluir esa fila (o resolverla) y confirmar la importación.
5. **Esperado**: se crean/actualizan solo las filas aprobadas; no se genera ningún destino duplicado; queda un registro consultable en el historial de importaciones con el resultado (FR-014).

## Escenario 6 — Herramienta de IA efectivamente invocable (FR-011)

1. Configurar un agente de IA sin ninguna herramienta CRM togglable habilitada (`herramientas: []` o `null`).
2. Simular/enviar un mensaje de un cliente preguntando por un destino configurado.
3. **Esperado**: la IA igual puede invocar `consultar_opciones_envio` y responder correctamente — confirma que el fix de disponibilidad en runtime (research.md §6) quedó aplicado, y no solo para el toggle manual de herramientas.

## Escenario 7 — Migración de datos existentes (FR-015)

1. En un entorno con `ZonaEntregaUbicacion` creadas antes de este feature (por ejemplo, del quickstart de spec 022), correr el backfill.
2. **Esperado**: todas esas filas quedan con `nombreVisible`/`nombreNormalizado` completos, y el matching por nombre normalizado funciona sobre ellas sin haber sido recargadas manualmente.

## Validación técnica de respaldo

- `npm run test:unit` (Vitest) — cubre `normalizarTexto`/`normalizarUbicacion`, `similitud-texto`, el algoritmo de confianza de `obtenerOpcionesEnvioConConfianza`, unicidad de alias, y `calcularCamposNormalizados`/`ejecutarBackfill` del script de backfill.
- Confirmar explícitamente con un test dedicado que `obtenerCandidatosEnvioPorZona` sin el flag nuevo produce el mismo resultado que antes de este feature (regresión de FR-010).
- `npm run build` — sin errores de tipos tras extender el schema de Prisma y regenerar el cliente.
- Test e2e (Playwright) extendiendo `tests/e2e/sales/transportistas.spec.ts` — flujo de alias (Escenario 1) y de importación (Escenario 5).
