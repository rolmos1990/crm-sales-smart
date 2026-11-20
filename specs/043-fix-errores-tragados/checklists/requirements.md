# Specification Quality Checklist: Las páginas dejan de esconder los fallos de lectura

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-19
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

## Hotfix-specific (docs/SPEC-KIT-WORKFLOWS.md)

- [x] Sección "Diagnóstico previo" presente como primer contenido, antes de User Scenarios
- [x] Causa raíz confirmada con evidencia de código (`archivo:línea`), no supuesta
- [x] Se documenta explícitamente qué SÍ funciona, para no tocarlo
- [x] Al menos un Functional Requirement de tipo "MUST NOT alterar el comportamiento existente" (FR-009)
- [x] Nombre corto con prefijo `fix-`

## Notes

### Sobre "no implementation details"

El **Diagnóstico previo** sí cita archivos, líneas y nombres de función. Es deliberado y lo exige el flujo Hotfix: sin evidencia concreta la causa raíz sería una suposición. Las secciones normativas —User Scenarios, Requirements, Success Criteria— se mantienen en lenguaje de producto y son verificables sin leer el código, con una excepción justificada:

- **FR-006** nombra el guard `DATABASE_URL.includes("placeholder")` y **FR-009** nombra `construirCondicionVenta`. Se conservan así a propósito: son las dos piezas exactas que el implementador debe tocar y no tocar respectivamente, y describirlas en prosa ("el guard de entorno", "la función que deriva qué cuenta como venta") las haría ambiguas justo donde el riesgo de error es mayor. Precedente: 038 hace lo mismo con `cuentaComoVenta`.

### Decisiones tomadas sin consultar

Tres puntos se resolvieron con el criterio ya establecido en el proyecto en vez de marcarlos como clarificación:

1. **Cuatro bloques se conservan en lugar de eliminarse** (2 de degradación legítima + 2 listas secundarias del dashboard). Criterio: si el contenido principal ya está resuelto, un fallo secundario no debe tumbar la página. Alineado con 012 FR-004, que ya declara el perfil de cliente tolerante a fallo.
2. **El aviso de FR-007 no se diseña acá.** Se exige que exista y sea visible; su forma es decisión del plan.
3. **El umbral entre "principal" y "secundario"** se fija por la clasificación del diagnóstico, bloque por bloque, en vez de por una regla abstracta. Son 42 casos concretos ya inventariados; una regla general habría sido menos precisa y más discutible.

### Corrección aplicada durante `/speckit-plan`

El inventario inicial del spec decía 37 bloques en 30 archivos. Al verificar el recuento de guards `placeholder` apareció un archivo con el guard pero sin ningún `try/catch`: `src/app/productos/[id]/editar/page.tsx`. El defecto estaba escrito en una **segunda forma sintáctica**, `.catch(() => null)` encadenado a la promesa, que el barrido original no buscaba.

Un barrido por esa forma encontró 5 bloques más en 2 archivos de Productos. Cifras corregidas: **42 bloques en 32 archivos**, de los cuales **36 se eliminan**, 4 se conservan y 2 quedan fuera; **9** guards, no 8.

El hallazgo cambió además la severidad de un caso: `productos/[id]/editar` degrada la lista de componentes de un combo a `[]`, y guardar el formulario persiste esa composición vacía. Es pérdida de datos, no solo un valor por defecto mal elegido — el peor caso de la categoría B.

De ahí sale el requisito de D5 en `research.md`: el test-guardia debe detectar ambas formas. Si repitiera el sesgo del barrido que lo originó, no protegería de nada.

### Riesgo principal a vigilar en `/speckit-plan`

Una edición mecánica de 36 bloques es exactamente donde se cuela una regresión por descuido: borrar de más (los 4 que se conservan, los 2 fuera de alcance) o borrar el `notFound()` legítimo junto con el guard muerto. El plan debería tratar la tabla del diagnóstico como lista de verificación cerrada y confirmar el recuento final contra SC-005.
