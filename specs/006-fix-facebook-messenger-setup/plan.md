# Implementation Plan: Acceso al login/configuración de Facebook Messenger desde Integraciones

**Branch**: `006-fix-facebook-messenger-setup` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-fix-facebook-messenger-setup/spec.md`

## Summary

La investigación de causa raíz (hecha en `/speckit-specify`) ya identificó el origen exacto: `CardIntegracion` (`src/integraciones/components/lista-integraciones.tsx`) muestra un botón "Configurar" que enlaza a la pantalla dedicada de cada integración solo cuando `estado === "ACTIVA"` **y** `integracion.clave` es `"whatsapp_lite"` o `"instagram"` — una condición codificada a mano por integración a la que nunca se sumó `"facebook_messenger"`, aunque su pantalla dedicada (`/integraciones/facebook-messenger`, con el login de Meta) ya existe y funciona desde `005-facebook-messenger-integracion`. El fix es agregar esa tercera clave a la condición ya existente — no se construye ninguna pantalla, ruta ni lógica nueva.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: Ninguna nueva — mismo componente (`lucide-react` para el ícono `Settings2` ya usado por los otros dos casos, `next/link`)

**Storage**: N/A — no se toca ningún modelo ni consulta; `IntegracionInstancia.estado` ya existe y ya se lee

**Testing**: Validación manual según `quickstart.md` — es un cambio puramente de presentación (una condición de render), sin lógica de negocio que amerite un test unitario nuevo

**Target Platform**: Web (`/integraciones`, tarjeta de Facebook Messenger)

**Project Type**: Web application — mismo proyecto Next.js único ya existente

**Performance Goals**: N/A — sin impacto medible, un botón condicional más en un componente ya renderizado

**Constraints**: No alterar el comportamiento de "Configurar" ya existente para WhatsApp Lite/Instagram, ni el ciclo genérico Instalar/Activar/Desactivar/Desinstalar de ninguna otra integración del catálogo (FR-003); no tocar el flujo de login de Meta ni `CuentaCanal` (FR-004) — ya construidos y correctos en `005-facebook-messenger-integracion`

**Scale/Scope**: 1 archivo, 1 condición — `src/integraciones/components/lista-integraciones.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — el cambio vive en el componente de presentación ya existente del módulo `integraciones`, extendiendo un patrón ya usado (no una abstracción paralela). |
| II. Server-Enforced Business Rules | N/A — no hay reglas de negocio nuevas; es un enlace de navegación condicional en el cliente. |
| III. Reliable Data and Events | N/A — sin datos, transacciones ni eventos nuevos. |
| IV. Replaceable Integrations | N/A — no se toca ningún provider ni el contrato con Meta; el login de Meta ya construido en `005-facebook-messenger-integracion` no cambia. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — riesgo mínimo (una condición de render más); no expone ningún dato ni ruta que no estuviera ya accesible (`/integraciones/facebook-messenger` ya requiere sesión y permisos, sin cambios). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` no agrega entidades — confirma que no hay nada que re-evaluar. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/006-fix-facebook-messenger-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output — confirma que no hay alternativa de diseño real, solo la condición faltante
├── data-model.md         # Phase 1 output — declara explícitamente "sin entidades nuevas"
└── quickstart.md         # Phase 1 output — guía de validación manual
```

No se genera `tasks.md` en este paso (Fase 2, comando `/speckit-tasks`, opcional dado el tamaño del cambio). No se genera `contracts/`: no hay ninguna superficie nueva (API, webhook, etc.) — es un cambio de UI puro sobre una condición ya existente.

### Source Code (repository root)

```text
src/
└── integraciones/
    └── components/
        └── lista-integraciones.tsx   # FR-001/FR-002 — sumar clave "facebook_messenger" a la condición del botón "Configurar"
```

**Structure Decision**: no se crea ningún módulo ni archivo nuevo. El cambio vive en el único componente de presentación ya responsable de este patrón.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
