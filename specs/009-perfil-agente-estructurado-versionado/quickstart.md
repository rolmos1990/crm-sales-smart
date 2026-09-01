# Quickstart: Validación de perfil estructurado y versionado del agente de IA

## Prerrequisitos

- Instancia con IA habilitada (`ConfiguracionIA.habilitado = true`) y al menos un `ProveedorIA` activo con API key válida.
- Un usuario tipo `AGENTE` con `AgenteIAConfig` ya existente (agente COMERCIAL de prueba).
- Migraciones de esta spec aplicadas (`npm run db:migrate`).

## Escenario 1 — Configuración estructurada se refleja en el prompt (Historia 1)

1. Entrar a `/configuracion` → tab "Inteligencia Artificial" → seleccionar el agente de prueba.
2. En la sección **Reglas**, agregar un comportamiento prohibido: "Presionar para comprar", y una frase prohibida: "no te vas a arrepentir".
3. En la sección **Reglas**, agregar una condición de transferencia a humano: "el cliente menciona un reclamo o reembolso".
4. Guardar como borrador (no publicar todavía).
5. Desde el panel de una conversación de prueba, pedir una sugerencia de IA (`generarSugerenciaIA`) — **verificar que la respuesta sigue generándose con la configuración publicada anterior**, sin las reglas nuevas (porque todavía están en borrador).
6. Publicar la versión (sección **Versiones** → Publicar).
7. Repetir el paso 5 — **verificar que ahora el comportamiento prohibido y la condición de transferencia están reflejados** (indirectamente: pedir una sugerencia sobre un mensaje de cliente que mencione un reclamo y confirmar que la respuesta sugiere transferir, no resolverlo).

**Resultado esperado**: el prompt generado (visible en logs de desarrollo o inspeccionando el payload enviado al proveedor) incluye las nuevas reglas después de publicar, y no antes.

## Escenario 2 — Contradicción advertida, no bloqueada (Historia 1, escenario 4)

1. En el campo avanzado de instrucciones libres (`sistemaPrompt`), escribir: "Puedes confirmar precios directamente sin verificar disponibilidad."
2. Intentar publicar.
3. **Verificar**: aparece una advertencia visible señalando la contradicción con la regla obligatoria de no prometer precio/disponibilidad sin consultar (FR-005/FR-007).
4. Confirmar igualmente la publicación.
5. **Verificar**: la publicación se completa (no bloqueo forzado).

## Escenario 3 — Versionado: borrador, publicar, historial, restaurar, duplicar (Historia 2)

1. Con el agente ya en una versión publicada (`numero = 1`), editar cualquier campo y guardar como borrador.
2. **Verificar** en la sección Versiones: aparece un borrador sin número, y la versión 1 sigue marcada como publicada vigente.
3. Publicar el borrador → **verificar**: nueva versión `numero = 2`, publicada vigente; la versión 1 sigue visible en el historial.
4. Elegir "Restaurar" sobre la versión 1 → **verificar**: se crea una versión `numero = 3` con el contenido de la versión 1, ahora vigente; la versión 2 sigue en el historial (no se borra).
5. Elegir "Duplicar" sobre la versión 2 → **verificar**: se crea un nuevo borrador editable con el contenido de la versión 2, sin afectar la versión 3 vigente.

**Resultado esperado**: en ningún paso desaparece una versión anterior del historial (SC-003).

## Escenario 4 — Trazabilidad de versión en una respuesta generada (Historia 2, escenario 4)

1. Generar una respuesta real del agente (o una sugerencia) estando la versión 2 publicada.
2. Consultar el registro de `UsoIA` correspondiente (vía Prisma Studio o la pantalla de estadísticas de IA existente).
3. **Verificar**: el registro tiene `agenteIAConfigVersionId` apuntando a la versión 2.
4. Publicar una versión 3 y generar una nueva respuesta.
5. **Verificar**: el nuevo registro de `UsoIA` apunta a la versión 3; el registro anterior (paso 3) sigue apuntando a la versión 2.

## Escenario 5 — Retrocompatibilidad total (SC-002)

1. Tomar un agente existente **sin ningún campo nuevo configurado y sin ninguna versión publicada creada tras el despliegue** (agente "legacy").
2. Generar una respuesta real.
3. **Verificar**: el prompt generado es idéntico (mismo contenido y orden) al que se generaba antes de esta spec — ninguna sección nueva aparece porque todos los campos nuevos están vacíos.

## Escenario 6 — Navegación por secciones (Historia 3)

1. Entrar a la configuración del agente.
2. **Verificar**: existen sub-secciones diferenciadas Identidad, Comunicación, Reglas y Versiones dentro de la tab "Inteligencia Artificial", cada una mostrando solo los campos que le corresponden.
