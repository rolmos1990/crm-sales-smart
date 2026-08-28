# Quickstart: Validar el enriquecimiento de contacto de Facebook Messenger

**Feature**: `007-enriquecer-contacto-messenger` | **Date**: 2026-08-27

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`, worker de RabbitMQ activo
- Una Página de Facebook conectada para Messenger (`005-facebook-messenger-integracion`)
- Un usuario de prueba (o tu propia cuenta de Facebook, como ya hiciste) que tenga un rol en la app de Meta — Standard Access alcanza para este caso, no depende de que `Business Asset User Profile Access` ya esté aprobada (ver research.md R2)

## Escenarios a validar

### 1. Nombre y foto se completan en un contacto nuevo (US1 — P1)

1. Desde una cuenta de Facebook con rol en la app (por ejemplo la tuya, como ya probaste), enviarle un mensaje nuevo a la Página conectada, desde un contacto que no exista todavía en el CRM.
2. Revisar el contacto creado en el CRM.
3. **Verificar**: el contacto tiene el nombre completado (no queda en blanco/placeholder) y, si el remitente tiene foto de perfil pública, también la foto.

### 2. No se sobrescribe un contacto ya completado (Acceptance Scenario 3)

1. Editar a mano el nombre o la foto de un contacto ya existente (de cualquier canal).
2. Hacer que ese mismo contacto escriba de nuevo por Messenger.
3. **Verificar**: el nombre/foto editados a mano no cambian.

### 3. Degradación segura sin nombre/foto disponible (Edge Case)

1. Si es posible, provocar que la consulta de perfil falle (por ejemplo, un remitente sin datos públicos, o probar antes de tener `Business Asset User Profile Access` aprobado con un remitente que no sea tester de la app).
2. **Verificar**: el mensaje igual llega al inbox y se crea la conversación — el contacto queda sin nombre/foto, pero nada se rompe ni queda en un estado de error visible para el agente.

### 4. Cero regresión en Instagram (FR-006)

1. Repetir el escenario 1 con una conversación nueva de Instagram.
2. **Verificar**: el comportamiento de enriquecimiento de Instagram (nombre, username, foto) sigue funcionando exactamente igual que antes de este cambio.

## Criterio de aceptación

Los escenarios 1 y 2 cubren SC-001 a SC-003. El escenario 3 cubre SC-004. El escenario 4 confirma que no hay regresión sobre la integración hermana — mismo criterio de cuidado ya aplicado en `005-facebook-messenger-integracion`.
