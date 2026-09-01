# Quickstart: Validación de enrutamiento de modelos de IA por objetivo

## Prerrequisitos

- Instancia con al menos 2 `ProveedorIA` activos (ej. uno DeepSeek/NVIDIA de bajo costo, uno Anthropic de mayor capacidad).
- Migración de esta spec aplicada (`IDENTIFICACION_PRODUCTO` en el enum `TareaIA`).

## Escenario 1 — Asignar y persistir (Historia 1)

1. Entrar a `/configuracion` → tab "Inteligencia Artificial" → sección "Enrutamiento por objetivo" (nueva).
2. Asignar el proveedor económico a: Clasificación de intención, Extracción de datos, Resumen, Identificación de productos, Detección de sentimiento.
3. Asignar el proveedor superior a: Conversación de mayor razonamiento.
4. Dejar "Conversación estándar" sin asignar.
5. Guardar y recargar la página.
6. **Verificar**: todas las asignaciones persisten; "Conversación estándar" muestra el indicador de "usa el criterio por defecto".

## Escenario 2 — Enforcement real (Historia 2)

1. Con la configuración del Escenario 1, disparar una clasificación de intención real (o de prueba) para la instancia.
2. Revisar el registro de `UsoIA` generado.
3. **Verificar**: `proveedorIAId` corresponde al proveedor económico asignado a `CLASIFICACION`.
4. Generar una respuesta de conversación pasando `requiereRazonamientoSuperior: true` (desde un caller de prueba o desde un flujo que ya lo soporte tras `012`/`013`).
5. **Verificar**: el `UsoIA` generado usa el proveedor superior asignado a `CHAT_RAZONAMIENTO_SUPERIOR`.
6. Generar una respuesta de conversación estándar (sin la señal).
7. **Verificar**: usa el criterio por defecto actual (prioridad + tipo de agente), ya que "Conversación estándar" quedó sin asignar en el Escenario 1.

## Escenario 3 — Resguardo ante proveedor no disponible

1. Desactivar (o forzar circuit breaker de) el proveedor asignado a `RESUMEN`.
2. Disparar una tarea de resumen.
3. **Verificar**: la llamada se completa usando el siguiente proveedor activo disponible (mecanismo de resguardo ya existente), no falla.
4. Volver a entrar a la sección de enrutamiento.
5. **Verificar**: la asignación de `RESUMEN` se muestra marcada como inválida (FR-008), sin bloquear el resto de la pantalla.

## Escenario 4 — Retrocompatibilidad total (SC-003)

1. Tomar una instancia sin ninguna asignación de objetivo configurada.
2. Generar respuestas de varios objetivos distintos.
3. **Verificar**: el proveedor usado en cada caso es exactamente el que se hubiera seleccionado antes de esta spec (prioridad + `tipoAgenteIA`), sin ninguna diferencia observable.

## Escenario 5 — Auditoría (Historia 3)

1. Con llamadas de al menos 3 objetivos distintos ya registradas, abrir el panel de estadísticas de uso de IA existente.
2. **Verificar**: cada registro muestra su objetivo (`tarea`) y el proveedor/modelo que lo atendió, visibles sin pasos adicionales.
