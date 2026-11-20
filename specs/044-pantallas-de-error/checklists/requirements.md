# Specification Quality Checklist: Pantallas de error con la identidad de Karia

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

## Feature-specific (docs/SPEC-KIT-WORKFLOWS.md)

- [x] Es Feature y no Hotfix: la capacidad —pantallas de error con la identidad del producto— nunca existió. El repositorio no tiene ningún archivo de pantalla de error ni de "no encontrado"; lo que se ve es el valor por defecto del entorno
- [x] Sin sección "Diagnóstico previo": corresponde solo a Hotfix
- [x] La primera historia (P1) es un incremento entregable por sí solo
- [x] Nombre corto descriptivo, sin prefijo `fix-`

## Notes

### Por qué es Feature y no Hotfix

El caso límite está documentado en `docs/SPEC-KIT-WORKFLOWS.md` con el ejemplo de `007`: un pedido puede *parecer* una corrección y ser una capacidad nueva. Acá pasa lo mismo. El usuario lo describió como un síntoma ("veo una pantalla negra"), pero Karia nunca prometió ni mostró una pantalla de error propia: simplemente no hay ninguna, y lo que aparece es el valor por defecto del entorno. No hay nada roto que arreglar; hay algo que construir.

Distinto fue `043`, que sí era Hotfix: ahí Karia mostraba un listado vacío o un 404 afirmando algo falso sobre los datos del usuario.

### Decisiones tomadas sin consultar

1. **Se incluyó la pantalla de acceso denegado (FR-011).** No estaba en la pregunta original, pero es el mismo problema: solo se llega a ella con sesión iniciada y aun así pierde el menú. Integrarla cuesta un archivo y evita dejar una pantalla huérfana de la misma familia.
2. **El código de soporte se apoya en el identificador que el entorno ya genera**, en vez de inventar uno propio. Ese identificador ya queda registrado del lado del servidor, así que es correlacionable sin infraestructura nueva.
3. **El contrato de las acciones de escritura, la validación por campo, el registro estructurado y la idempotencia quedaron fuera.** Son necesarios para cerrar el manejo de errores completo, pero mezclarlos acá convertiría una Feature acotada y entregable en una indefinida. Están anotados en Assumptions para que no se pierdan.

### Los dos límites que el plan no podrá eliminar

Conviene que estén aceptados antes de planificar, porque ninguna decisión de diseño los levanta:

1. Una dirección que no corresponde a ninguna sección no puede traer el menú de ninguna sección.
2. Un fallo del armazón autenticado no puede mostrar el menú que ese armazón construye.

El spec los trata como tales en las historias 3 y 4: para esos dos casos se promete identidad visual y salida, no menú. Si en la planificación aparece la tentación de prometer menú ahí, es señal de que algo se entendió mal.

### Riesgo a vigilar en `/speckit-plan`

Que las pantallas se multipliquen sin compartir anatomía. Son al menos trece ubicaciones distintas; si cada una se escribe por separado, en tres meses hay trece diseños ligeramente distintos. FR-009 existe por eso, y el plan debería hacerlo cumplir con un único componente compartido y envoltorios mínimos.
