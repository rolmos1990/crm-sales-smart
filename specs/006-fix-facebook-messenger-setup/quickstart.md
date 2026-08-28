# Quickstart: Validar el acceso a Configurar Facebook Messenger

**Feature**: `006-fix-facebook-messenger-setup` | **Date**: 2026-08-27

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`
- Sesión con permiso `integraciones` (`ver`/`modificar`)

## Escenarios a validar

### 1. El botón "Configurar" aparece al activar (US1 — P1)

1. Ir a `/integraciones`, buscar la tarjeta "Facebook Messenger".
2. Si no está instalada: "Instalar" → "Activar".
3. **Verificar**: junto al botón "Desactivar" aparece un botón "Configurar" (mismo estilo que ya se ve en las tarjetas de WhatsApp Lite e Instagram cuando están activas).
4. Clic en "Configurar".
5. **Verificar**: navega a `/integraciones/facebook-messenger` y se ve el botón "Conectar Facebook Messenger" (el login de Meta ya construido en `005-facebook-messenger-integracion`, sin cambios).

### 2. No aparece antes de activar (Edge Case)

1. Con Facebook Messenger instalada pero **no** activa (estado "Instalada").
2. **Verificar**: no se ve ningún botón "Configurar" — solo "Activar" (mismo comportamiento que hoy tienen WhatsApp Lite/Instagram en ese estado).

### 3. Cero regresión en WhatsApp Lite / Instagram / resto del catálogo (FR-003 — crítico)

1. Repetir el paso 1 para una integración de WhatsApp Lite activa y para Instagram activa.
2. **Verificar**: el botón "Configurar" de ambas sigue llevando a sus pantallas respectivas, sin ningún cambio de comportamiento.
3. Revisar una integración "Próximamente" (por ejemplo Mailchimp) y **verificar** que su tarjeta se ve exactamente igual que antes (deshabilitada, sin botón "Configurar").

## Criterio de aceptación

Los escenarios 1 y 2 cubren SC-001. El escenario 3 confirma SC-002 (cero regresión). No se requiere ejecutar ninguna suite automatizada nueva — es un cambio de una condición de render, sin lógica de negocio que testear.
