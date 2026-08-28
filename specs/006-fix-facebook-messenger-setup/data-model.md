# Data Model: Acceso al login/configuración de Facebook Messenger

**Feature**: `006-fix-facebook-messenger-setup` | **Date**: 2026-08-27

Sin entidades nuevas, sin cambios de esquema, sin nuevas consultas. El único dato involucrado es `IntegracionInstancia.estado` (ya existente, ya leído por `CardIntegracion`) y `integracion.clave` (ya existente en `CATALOGO_INTEGRACIONES`, `src/integraciones/catalog.ts`) — este fix solo agrega una rama de renderizado condicional que ya lee esos dos valores, sin persistir ni consultar nada adicional.
