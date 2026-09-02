# Quickstart: Validar Alias único para múltiples instancias del mismo proveedor de IA

## Prerequisitos

- Migración aplicada: `npm run db:migrate` (agrega `alias`/`aliasNormalizado` a `ProveedorIA`, backfillea filas existentes, reemplaza la restricción única — ver [data-model.md](data-model.md)).
- Sesión con acceso a `/configuracion` → pestaña Inteligencia Artificial, con permiso `ia:modificar`.
- Al menos una API key de prueba para DEEPSEEK (o usar `LOCAL`, que no requiere key).

## Escenario 1 — Crear dos agentes del mismo proveedor (User Story 1)

1. Ir a Configuración → IA → sección Proveedores → "Agregar proveedor IA".
2. Elegir proveedor `DEEPSEEK`, completar Alias = `DeepSeek Ventas`, guardar.
3. Repetir: proveedor `DEEPSEEK` otra vez (mismo token o distinto), Alias = `DeepSeek Soporte`, guardar.
4. **Esperado**: ambos quedan listados como filas independientes en "Proveedores", cada una mostrando su propio Alias (FR-001, FR-002, SC-001).
5. Repetir el paso 3 usando exactamente `DeepSeek Ventas` como Alias.
6. **Esperado**: el guardado se rechaza con un mensaje indicando que el alias ya está en uso, antes de persistir nada (FR-005, SC-002).

## Escenario 2 — Editar el Alias de un agente existente (User Story 2)

1. Sobre el agente "DeepSeek Soporte" creado arriba, usar la acción "Editar".
2. Cambiar el Alias a `deepseek ventas ` (mismas letras que el otro agente, distinta capitalización y con espacio final).
3. **Esperado**: rechazado — el sistema compara alias ignorando mayúsculas y espacios de borde (FR-004, Edge Case correspondiente).
4. Guardar el mismo formulario sin cambiar el Alias (dejar "DeepSeek Soporte" tal cual).
5. **Esperado**: se guarda sin error de "alias duplicado consigo mismo" (FR-007).
6. Cambiar el Alias a `DeepSeek Soporte Norte` y guardar.
7. **Esperado**: se guarda correctamente y el nuevo Alias aparece de inmediato en el listado de Proveedores.

## Escenario 3 — Ver el Alias en el enrutamiento por objetivo (User Story 3)

1. Con los dos agentes DeepSeek activos del Escenario 1/2, ir a la sección "Enrutamiento por objetivo" (misma pantalla de Configuración → IA).
2. Abrir el selector de cualquier objetivo (ej. "Clasificación de intención").
3. **Esperado**: el menú lista `DeepSeek Ventas` y `DeepSeek Soporte Norte` como opciones distintas (no "DEEPSEEK" repetido dos veces) (FR-008, SC-003).
4. Asignar "DeepSeek Ventas" al objetivo, guardar, recargar la página.
5. **Esperado**: la asignación sigue mostrando "DeepSeek Ventas" tras recargar.

## Escenario 4 — Agentes creados antes de esta feature (FR-009, SC-004)

1. En una base con datos previos a esta migración (o revisando el resultado de la migración en un entorno de prueba con datos existentes), listar los proveedores en Configuración → IA.
2. **Esperado**: todo agente preexistente muestra un Alias no vacío y único (derivado del nombre del proveedor, con sufijo si había más de uno igual), sin ninguna acción manual previa.
3. Verificar que esos agentes siguen apareciendo como opciones válidas en el selector de enrutamiento por objetivo.

## Validación técnica de respaldo

- `npm run test:unit` — cubre la validación de Zod (`alias` obligatorio, máx. 50) y la lógica de las nuevas Server Actions (duplicado case-insensitive, exclusión del propio `id` en edición, mensaje de error sin detalles internos de Prisma).
- Confirmar en `prisma/schema.prisma` que `@@unique([instanciaId, proveedor, tipoAgenteIA])` ya no existe y que `@@unique([instanciaId, aliasNormalizado])` sí.
