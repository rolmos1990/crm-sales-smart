# Quickstart: Validación de playbooks de estrategia comercial

## Prerrequisitos

- Migraciones y seed de esta spec aplicados (`npm run db:migrate && npm run db:seed`).
- Un agente COMERCIAL de prueba ya existente.

## Escenario 1 — Plantillas precargadas y gestión (Historia 1)

1. Entrar a la sección de Estrategias (dentro de la tab IA).
2. **Verificar**: las 7 plantillas están listadas, todas inactivas.
3. Activar "Cliente nuevo" y "Cliente con intención alta".
4. Editar el contenido de "Cliente nuevo" agregando una regla propia.
5. Duplicar "Recomendación basada en ocasión" → **verificar**: aparece una copia `PERSONALIZADA`, inactiva, y la original sigue intacta.
6. Asignar prioridad 10 a "Cliente con intención alta" y prioridad 5 a "Cliente nuevo".
7. Desactivar "Cliente nuevo" → **verificar**: ya no aparece como asignable, pero su contenido y edición previa se conservan.

## Escenario 2 — Selección explicable (Historia 2)

1. Asignar al agente de prueba: "Cliente nuevo" (condición: tipo de relación = `NUEVO_CONTACTO`, `CLIENTE_NUEVO`) y "Cliente con intención alta" (condición: intención = `LISTO_PARA_COMPRAR`), ambas activas.
2. Invocar `seleccionarEstrategia` (desde un test o un flujo de prueba) con `{ tipoRelacion: "NUEVO_CONTACTO" }`.
3. **Verificar**: selecciona "Cliente nuevo", motivo indica coincidencia por tipo de relación.
4. Invocar con `{ intencion: "LISTO_PARA_COMPRAR" }`.
5. **Verificar**: selecciona "Cliente con intención alta".
6. Invocar con `{ tipoRelacion: "CLIENTE_REGULAR" }` (sin coincidencia con ninguna condición asignada).
7. **Verificar**: `estrategiaSeleccionada: null`, motivo indica que no hubo coincidencias entre 2 estrategias evaluadas.
8. Invocar sin ninguna señal (`{}`).
9. **Verificar**: mismo resultado que el paso 7 — comportamiento por defecto, sin fallo (Edge Case de datos faltantes).
10. Revisar `SeleccionEstrategiaLog` para cada invocación anterior — **verificar**: cada una quedó registrada con su motivo, consultable en menos de 3 pasos desde una pantalla de auditoría o Prisma Studio.

## Escenario 3 — Empate de prioridad

1. Asignar dos estrategias con la misma condición (`intencion: EXPLORANDO`) y la misma `prioridadEfectiva`.
2. Invocar el selector con `{ intencion: "EXPLORANDO" }`.
3. **Verificar**: se selecciona una de forma determinística (la de asignación más reciente) y el log indica que hubo un empate entre 2 candidatas.

## Escenario 4 — No eliminar estrategia asignada (FR-011)

1. Con "Cliente con intención alta" asignada al agente de prueba, intentar eliminarla.
2. **Verificar**: la eliminación es rechazada con un mensaje indicando cuántos agentes la tienen asignada.
3. Quitar la asignación y reintentar eliminar.
4. **Verificar**: ahora se elimina correctamente.

## Escenario 5 — Retrocompatibilidad (SC-004)

1. Tomar un agente sin ninguna estrategia asignada.
2. Generar una respuesta real.
3. **Verificar**: el comportamiento es idéntico al que tenía antes de esta spec — ninguna estrategia interfiere.
