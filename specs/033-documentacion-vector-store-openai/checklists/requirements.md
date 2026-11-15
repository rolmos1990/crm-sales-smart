# Specification Quality Checklist: Documentación del comercio consultable bajo demanda

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Iteración 1 — hallazgos corregidos

1. **Fugas de implementación en los requisitos**: la primera redacción nombraba el proveedor y sus endpoints
   (vector store, Responses API, `file_search`) dentro de los FR. Reescrito en términos de capacidad —
   "servicio de indexación", "búsqueda documental" — dejando las decisiones técnicas para `plan.md` y
   `research.md`. Las únicas menciones concretas que sobreviven están en **Assumptions**, que es donde
   corresponde documentar la consecuencia de una decisión ya tomada.
2. **Criterios de éxito con métricas técnicas**: se reemplazó "tokens por request" por el resultado de
   negocio observable (SC-009: el consumo de contexto por mensaje baja).
3. **Requisitos no verificables**: "el agente debe ser inteligente al decidir" se convirtió en la política
   enumerada de FR-017 y en SC-003, que la mide con una batería de 20 conversaciones.

### Decisiones ya cerradas antes del spec (no son clarificaciones pendientes)

| Decisión | Resuelto |
|---|---|
| Mecanismo de búsqueda y contabilización | Búsqueda con síntesis, para obtener tokens reales del proveedor |
| Imágenes (PNG/SVG/JPG) | Rechazo explícito — el servicio no las indexa |
| Documentos del mecanismo anterior | Sin migración: "Requiere resubir" |
| Alcance del índice | Uno por cuenta (aislamiento físico entre comercios), con documentos separados por agente dentro de ella mediante identidad y filtro obligatorio |
| Credencial del proveedor | De la plataforma, por entorno — así la funcionalidad existe también para cuentas cuyo agente usa otro proveedor de IA |

### Riesgo principal a vigilar en `/speckit-plan`

El aislamiento (FR-011 a FR-015) descansa en un filtro lógico y no en una frontera física. El plan debe
demostrar que ese filtro es **estructuralmente imposible de omitir** —una única fuente, sin parámetro de
override, con verificación a posteriori— y que hay tests que fallan si alguien lo relaja. Es el punto donde
esta feature puede violar el Principio V de la Constitución ("toda query y mutación scoped al tenant
autenticado") si se implementa con descuido.
