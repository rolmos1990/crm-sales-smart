# Quickstart: Validar el diagnóstico de envíos de Instagram fuera de ventana

**Feature**: `004-fix-instagram-human-agent` | **Date**: 2026-08-27

Guía de validación manual. A diferencia de las features de dark mode, esta sí requiere poder **provocar** los distintos motivos de fallo — algunos son fáciles de simular con datos locales, otros dependen de que Meta efectivamente rechace un envío real.

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`, worker de RabbitMQ activo (o forma equivalente de procesar la cola de envío usada en desarrollo)
- Una cuenta de Instagram conectada (`CuentaCanal` con `canal = "instagram"`) y al menos una conversación con mensajes de un contacto

## Escenarios a validar

### 1. Fallo visible sin necesidad de hover (US1 — P1)

1. Provocar un mensaje `FALLIDO` con `codigoError = "HUMAN_AGENT_NO_APROBADO"` — la forma más simple en desarrollo es actualizar directamente un `MensajeConversacion` existente a `estado: "FALLIDO"`, `codigoError: "HUMAN_AGENT_NO_APROBADO"`, `motivoError: "La ventana estándar de 24h de Instagram expiró y esta integración no tiene habilitada la extensión para agentes humanos."` (o generarlo de punta a punta si se cuenta con una cuenta de prueba donde Meta efectivamente rechace el envío).
2. Abrir esa conversación en el Inbox.
3. **Verificar**: el motivo se ve directamente en la burbuja del mensaje, sin necesidad de pasar el mouse sobre ningún ícono.
4. Repetir con `codigoError = "FUERA_VENTANA_MENSAJERIA"` y confirmar que el texto mostrado es distinto y específico a ese caso (Escenario 2 de las Acceptance Scenarios en `spec.md`).
5. Repetir con `codigoError = "ERROR_TEMPORAL_META"` (o similar) y confirmar que el tono/mensaje no implica un problema de aprobación de Meta (Escenario 3).

### 2. Estado de Human Agent por cuenta (US2 — P2)

1. Con al menos un mensaje `FALLIDO`/`codigoError = "HUMAN_AGENT_NO_APROBADO"` en los últimos 30 días para una cuenta conectada, ir a Integraciones → Instagram.
2. **Verificar**: la cuenta muestra la cantidad de mensajes rechazados por ese motivo en los últimos 30 días, sin tener que abrir ninguna conversación.
3. Con una cuenta sin rechazos recientes, **verificar** que se muestra el estado "sin rechazos" en vez de un conteo en cero poco claro.

### 3. No se alteró el comportamiento de envío (FR-001, FR-005)

1. Confirmar (por código o con un envío real dentro de la ventana de 24h) que un mensaje normal se sigue enviando sin tag y sin cambios.
2. Confirmar que un mensaje entre 24h y 7 días sigue intentando el tag `HUMAN_AGENT` automáticamente, igual que antes de esta feature.

## Criterio de aceptación

Los puntos "Verificar" de los escenarios 1 y 2 deben cumplirse (mapea a SC-001–SC-003 en `spec.md`); el escenario 3 confirma que SC-004 (sin regresión en la lógica de envío) se sostiene. No se requiere ejecutar ninguna suite automatizada nueva más allá de las ya existentes — este es un cambio de presentación y de una consulta de solo lectura, sin tocar la lógica de envío (FR-005).
