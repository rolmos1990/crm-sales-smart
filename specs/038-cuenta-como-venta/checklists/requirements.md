# Specification Quality Checklist: Cuenta como Venta en el Flujo de Venta

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-18
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

### Resultado de la validación

Las cuatro decisiones de negocio que podrían haber quedado como `[NEEDS CLARIFICATION]` se
resolvieron con el usuario **antes** de escribir el spec, así que no queda ninguna abierta:

| Decisión | Resolución |
|---|---|
| Eje de fecha de "Total ventas" al filtrar | Fecha de venta (cuándo llegó a la etapa), no fecha de creación — FR-017 |
| Qué pasa al salir de una etapa de venta | Deja de contar en el acto; la pertenencia se evalúa sobre la etapa actual — FR-007 |
| Reemplazo de "Pendientes"/"Expirados" | Se recalculan contra la entrega estimada — FR-026/FR-027 |
| Etapas marcadas al migrar | Finales no-cancelación — FR-030 |

### Iteraciones correctivas aplicadas

1. **Pasada 1 — fuga de implementación.** El borrador nombraba la columna `cuentaComoVenta`,
   la columna `fechaVenta` y la tabla `PedidoHistorialEtapa`. Reescrito en
   lenguaje de negocio ("el atributo Cuenta como Venta", "la fecha de entrada a la etapa
   actual", "el historial de etapas del pedido"). Los nombres técnicos pertenecen a
   `plan.md`/`data-model.md`, no al spec.
2. **Pasada 2 — criterios de éxito no verificables.** `SC-005` decía "el listado no agrega
   consultas"; se reformuló a tiempo de respuesta percibido, que se puede verificar sin
   conocer la implementación.
3. **Pasada 3 — supuesto sin declarar.** La lectura de "Expirados" como *atrasados* (y no
   como "entrega en el futuro") es una interpretación del pedido original del usuario:
   se movió a Assumptions de forma explícita para que se valide al revisar.

### Riesgos trasladados al plan

- **FR-024/FR-025** (depuración de Reglas de validación) es el único punto donde esta feature
  puede romper algo que hoy funciona: una regla construida sobre el campo eliminado dejaría
  de cumplirse y bloquearía transiciones. El plan debe tratarlo como paso previo a la
  eliminación del campo, no posterior.
- **FR-014** (registrar la fecha en los cuatro caminos de entrada a una etapa) es el punto
  donde es fácil dejar un agujero: dos de esos caminos crean el pedido ya ubicado en su
  etapa inicial y no pasan por el motor de etapas.

### Pendiente de confirmación al revisar

- La etiqueta de la tarjeta "Expirados": se conserva el nombre actual, pero ahora mide
  entregas atrasadas. Renombrarla a "Atrasados" es un cambio de texto sin impacto en el
  cálculo (ver Assumptions).
