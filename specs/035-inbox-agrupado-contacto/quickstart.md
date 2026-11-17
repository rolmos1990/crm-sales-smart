# Quickstart: validar el Inbox agrupado por contacto

**Feature**: 035-inbox-agrupado-contacto | **Fecha**: 2026-11-16

Guía para comprobar que la feature hace lo que el spec promete — y, sobre todo, que **no** cambió nada de lo
que ya funcionaba.

## Prerrequisitos

- Node 20+, PostgreSQL corriendo y `.env` configurado como para cualquier otra feature del proyecto.
- Base con datos: `npm run db:seed`.
- Para los escenarios multicanal hace falta **un contacto con dos o más conversaciones**. La forma natural
  de conseguirlo sin tocar el resolver de entrantes es combinar un canal de mensajería con el de correo
  (que siempre abre conversación propia), o usar dos hilos de un buzón configurado con agrupación por hilo.
  En un entorno sin canales reales, alcanza con crear la segunda conversación desde el CRM: la acción
  `iniciarConversacion` ya crea o reutiliza una conversación por contacto y cuenta de canal.

## Comandos

```bash
npm run test:unit                  # Vitest — incluye src/conversaciones/agrupacion.test.ts
npm run build                      # la constitución exige que compile
npm run dev                        # app en http://localhost:3000
npm run test:e2e:conversaciones    # Playwright — recorrido del Inbox
```

## Escenario 1 — Lista agrupada (US1 / FR-001 a FR-007)

1. Abrir `/crm/inbox`.
2. **Contacto con varias conversaciones**: aparece **una** fila con el nombre de la persona y el indicador
   de cuántas conversaciones tiene; debajo, una entrada por conversación, cada una con su canal y la hora de
   su último mensaje.
3. **Contacto con una sola conversación**: fila simple, sin indicador de grupo ni control de expansión —
   indistinguible de la de hoy.
4. Elegir una conversación del grupo: se abre el chat correcto, con su panel derecho.
5. Colapsar un grupo y **esperar a que pase el auto-refresco** (indicador de 30s en la barra superior): el
   grupo debe seguir colapsado. Este es el punto que más fácil se rompe.
6. Con un grupo colapsado que tiene mensajes sin leer: el indicador de no leídos y el aviso de atención
   humana siguen visibles en la fila de la persona.

## Escenario 2 — Aviso de otro canal (US2 / FR-012 a FR-015)

1. Conseguir que el mismo contacto tenga un mensaje **sin leer y más reciente** en una segunda conversación.
2. Abrir la **primera** conversación: dentro del chat aparece el aviso nombrando el otro canal y cuándo
   escribió.
3. Usar el aviso para saltar: se abre la otra conversación.
4. Volver a la primera y descartar el aviso: desaparece y no vuelve por ese mismo mensaje.
5. Abrir una conversación de un contacto cuya otra conversación **no** tiene mensajes sin leer: no debe
   aparecer ningún aviso.

## Escenario 3 — Identidades del contacto (US3 / FR-016 a FR-018)

1. Abrir cualquier conversación de un contacto con más de una identidad de canal.
2. En el panel derecho, la sección de identidades lista todas, con canal e identificador (o `@usuario`
   cuando el canal lo expone, como Instagram).
3. Una identidad con conversación cargada se puede abrir desde ahí.
4. Una identidad sin conversación cargada aparece listada, sin acción de apertura y sin fecha.

## Escenario 4 — Sin consultas nuevas (FR-019 / SC-003)

Es el criterio más fácil de violar sin darse cuenta, así que se verifica explícitamente.

1. DevTools → pestaña **Network**, filtro `Fetch/XHR`, y limpiar.
2. Recargar `/crm/inbox` y anotar las peticiones de la carga inicial.
3. **Expandir y colapsar grupos**: no debe aparecer ninguna petición nueva.
4. **Abrir el panel de identidades**: ninguna petición nueva.
5. **Dejar la pestaña quieta un minuto**: se ven exactamente dos ciclos de refresco (uno cada 30s), igual
   que antes del cambio.
6. Comparar contra la rama `main` con los mismos datos: la cantidad y el tipo de peticiones deben coincidir.

## Escenario 5 — No regresión (FR-022 / SC-005)

Recorrer lo que ya funcionaba, porque es la mitad del valor de esta feature:

- [ ] Seleccionar conversaciones y navegar entre ellas.
- [ ] Buscar por nombre, por teléfono y por contenido del último mensaje.
- [ ] Cambiar entre las cinco pestañas de filtro y verificar que **los contadores siguen contando
      conversaciones** (la suma de los grupos visibles cuadra con el número de la pestaña).
- [ ] Enviar un mensaje, y enviar una nota interna.
- [ ] Abrir el selector de plantillas y el botón "Generar respuesta con IA" — ambos dependen del
      `instanciaId` que se derivaba del selector de canal reemplazado; si desaparecieron, la etiqueta fija
      se implementó mal (ver research.md, Decisión 7).
- [ ] Verificar que el canal del chat se muestra como **etiqueta**, no como menú desplegable.
- [ ] Recibir un mensaje nuevo con la pestaña abierta (SSE): la conversación se actualiza y sube sin que se
      pierda la selección ni el estado de expansión.
- [ ] Marcar mensajes como leídos al abrir una conversación.
- [ ] Cerrar y reabrir una conversación.
- [ ] Achicar la ventana a menos de 768px: la lista ocupa el ancho completo y se oculta al abrir una
      conversación, con el botón de volver funcionando.

## Qué NO debe haber cambiado

Comprobaciones rápidas para confirmar que el alcance se respetó:

```bash
git diff --name-only main...HEAD
```

El diff **no** debe tocar: `prisma/`, `src/worker/`, `src/suscriptores/`, `src/ai/`, `src/workflows/`,
`src/integraciones/`, `src/conversaciones/actions.ts` ni `src/conversaciones/envio.ts`.

Los archivos esperados son: `src/conversaciones/agrupacion.ts`, `agrupacion.test.ts`, `types.ts`,
`queries.ts` (solo el mapeo), cuatro archivos en `src/conversaciones/components/`,
`tests/e2e/conversaciones/inbox.spec.ts` y los documentos de `specs/035-inbox-agrupado-contacto/`.
