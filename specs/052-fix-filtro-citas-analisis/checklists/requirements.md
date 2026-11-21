# Specification Quality Checklist: El filtro anti-citas deja de rechazar frases comerciales corrientes

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-21
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

- **Clasificación: Hotfix.** El análisis de contactos ya existía y ya prometía evaluar cada
  contacto; un control interno demasiado estricto lo rompe en el 5,8 % de los casos. Lleva
  sección "Diagnóstico previo" con causa raíz **reproducida contra la API real**, y FR-003 a
  FR-005, FR-008 y FR-009 son el requisito explícito de no alterar lo que ya funcionaba.

- **El umbral se eligió con una medición, no a ojo.** Es lo que más conviene mirar en revisión:
  los 1284 textos aceptados tienen solape máximo 24 **y el umbral es 25**. Esa coincidencia no
  dice que 25 sea holgado — dice que la muestra está **censurada por el propio umbral**. Los
  rechazados caen en 26–29. Sin hueco entre ambos grupos, cualquier corte en esa zona parte la
  distribución natural de la paráfrasis.

- **Excepción consciente a "no implementation details"**: el Diagnóstico previo cita
  `archivo:línea` y transcribe textos y tramos exactos. La plantilla de Hotfix lo **exige** y sin
  la evidencia el diagnóstico no es verificable. El resto del spec no nombra la constante, ni la
  función, ni el nombre del código de error.

- **Riesgo residual para `/speckit-plan`**: FR-006 pide distinguir tres motivos de rechazo, pero
  el filtro de privacidad en sí agrupa cinco controles (correo, URL, dígitos, dirección, cita).
  El plan debe decidir si "rechazado por privacidad" alcanza o si conviene separar "cita" del
  resto — que es justo la distinción que habría ahorrado esta investigación.

- **Lo que este hotfix NO cubre, y está dicho en el spec**: un dato sensible corto —una condición
  de salud mencionada al pasar— nunca lo atrapó este control y sigue sin atraparlo. Vive en las
  instrucciones fijas de la IA. Subir el umbral no empeora ese caso porque nunca lo cubrió.
