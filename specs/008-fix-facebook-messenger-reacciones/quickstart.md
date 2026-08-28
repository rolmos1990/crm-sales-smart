# Quickstart: Validar las reacciones de Facebook Messenger

**Feature**: `008-fix-facebook-messenger-reacciones` | **Date**: 2026-08-27

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`, worker de RabbitMQ activo
- Una Página de Facebook conectada para Messenger, con al menos una conversación con mensajes en ambos sentidos
- Después de desplegar el fix: correr una vez `npm run script:resuscribir-reacciones-messenger` (FR-005) — necesario incluso en desarrollo si la Página ya estaba conectada antes de este cambio

## Escenarios a validar

### 1. Reaccionar desde Karia llega a Facebook (US1 — P1)

1. Abrir una conversación de Messenger en Karia, reaccionar a un mensaje del cliente con un emoji.
2. Revisar la conversación real en Facebook (desde la cuenta del cliente o la vista de Página).
3. **Verificar**: la reacción aparece ahí.
4. Cambiar el emoji de la reacción desde Karia.
5. **Verificar**: en Facebook se ve el nuevo emoji, no los dos a la vez (Acceptance Scenario 3).
6. Quitar la reacción desde Karia.
7. **Verificar**: desaparece también en Facebook (Acceptance Scenario 2).

### 2. Reaccionar desde Facebook llega a Karia (US2 — P1)

1. Desde la cuenta de Facebook del cliente, reaccionar a un mensaje enviado por la Página.
2. Revisar esa conversación en Karia.
3. **Verificar**: la reacción aparece ahí, en menos de 10 segundos.
4. Quitar la reacción desde Facebook.
5. **Verificar**: desaparece también en Karia (Acceptance Scenario 2 de US2).

### 3. Corrección retroactiva sin reconectar (FR-005, Edge Case)

1. Confirmar que la Página usada en los escenarios 1 y 2 **ya estaba conectada antes** de correr `npm run script:resuscribir-reacciones-messenger`.
2. **Verificar**: los escenarios 1 y 2 funcionan igual sin haber desconectado/reconectado esa Página manualmente.

### 4. Cero regresión en Instagram (FR-007 — crítico)

1. Repetir los escenarios 1 y 2 con una conversación de Instagram.
2. **Verificar**: el comportamiento de reacciones de Instagram sigue funcionando exactamente igual que antes de este cambio.

## Criterio de aceptación

Los escenarios 1 y 2 cubren SC-001 a SC-003. El escenario 3 cubre SC-004. El escenario 4 confirma SC-005 — es, junto con el escenario 3, el más importante de validar antes de dar el fix por cerrado.
