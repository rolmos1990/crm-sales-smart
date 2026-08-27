# Quickstart: Validar la integración de Facebook Messenger

**Feature**: `005-facebook-messenger-integracion` | **Date**: 2026-08-27

Guía de validación manual end-to-end. Requiere una Página de Facebook de prueba (puede ser la misma usada para probar Instagram) y un usuario de prueba con rol de tester en la app de Meta usada por Karia (`META_APP_ID`/`META_APP_SECRET`), ya que `pages_messaging` todavía está en proceso de aprobación (ver `004-fix-instagram-human-agent`) — en modo desarrollo/Standard Access alcanza con testers, sin depender de que la revisión de Meta esté aprobada.

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`, worker de RabbitMQ activo
- `META_APP_ID`/`META_APP_SECRET` configurados (ya deberían estarlo — ver Diagnóstico previo en `spec.md`)
- Una Página de Facebook de prueba, con el usuario de prueba como administrador de esa Página
- `TOKENS_CIFRADO_KEY` configurada (reutilizada de la integración de Instagram — ver `004-fix-instagram-human-agent`)

## Escenarios a validar

### 1. Conectar una Página (US1 — P1)

1. Ir a Integraciones → buscar el componente "Facebook Messenger".
2. Iniciar la conexión, autorizar con el usuario de prueba, seleccionar la Página de prueba.
3. **Verificar**: la Página aparece listada como conectada y activa, con su nombre visible — sin recargar manualmente.
4. Repetir con una segunda Página de prueba (si hay disponible) y **verificar** que ambas quedan listadas de forma independiente (Acceptance Scenario 3).

### 2. Recibir y responder un mensaje (US2 — P1)

1. Desde una cuenta personal de Facebook (o Messenger) distinta a la de administrador, enviarle un mensaje de texto a la Página conectada.
2. **Verificar**: el mensaje aparece en el inbox de conversaciones de Karia en tiempo real, marcado como Facebook Messenger.
3. Responder desde el inbox de Karia.
4. **Verificar**: la respuesta llega al chat de Messenger del remitente.
5. Repetir enviando una imagen y un video desde Messenger y **verificar** que se muestran correctamente en la conversación (Acceptance Scenario 3 de US2).

### 3. Integración con Pipeline (US3 — P2)

1. Configurar un pipeline y etapa para la Página conectada (mismo panel donde ya se configura para Instagram).
2. Enviar un mensaje desde un contacto nuevo (que no exista aún en el CRM).
3. **Verificar**: se crea el contacto y la conversación se asocia al pipeline/etapa configurados, igual que ya sucede con Instagram.

### 4. Estado de la conexión (US4 — P3)

1. En el panel de Facebook Messenger, revisar el estado de la Página conectada.
2. **Verificar**: se muestra como activa/funcionando sin haber esperado un mensaje real.
3. Provocar un problema (por ejemplo, invalidar manualmente el token en desarrollo) y **verificar** que el panel refleja el problema en vez de mostrar "activa" indefinidamente.

### 5. Cero regresión en Instagram (FR-006, FR-007 — crítico)

1. Con la misma Página conectada tanto a Instagram (flujo heredado vía Página, si aplica) como a Facebook Messenger, o con Instagram en cualquier otra cuenta ya conectada, enviar un mensaje de prueba por Instagram.
2. **Verificar**: el mensaje se sigue procesando como Instagram (aparece en una conversación de Instagram, no de Messenger) — confirma la resolución de `research.md` R1.
3. Confirmar que el envío/recepción de Instagram (incluida la ventana de 24h/Human Agent) sigue funcionando exactamente igual que antes de activar Facebook Messenger — sin ningún cambio observable.

## Criterio de aceptación

Los escenarios 1–4 cubren SC-001 a SC-005 de `spec.md`. El escenario 5 es el más crítico de todos: si Instagram muestra cualquier cambio de comportamiento, la feature no está lista para desplegar aunque el resto pase — es la restricción explícita del pedido original ("no debe modificar o afectar el flujo actual de instagram").
