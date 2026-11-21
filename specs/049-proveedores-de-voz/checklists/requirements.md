# Specification Quality Checklist: Proveedores de Voz y transcripción de notas de voz

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-20
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

### Iteración 1 — correcciones aplicadas

Tres fallos encontrados y corregidos antes de cerrar el checklist:

1. **Detalle de implementación en el cuerpo del spec.** La versión inicial nombraba el
   proveedor concreto, su endpoint, el precio por hora y los nombres de tablas y columnas
   (`MediaArchivo`, `ProveedorVoz`, `transcripcionVozHabilitada`). Se removieron del cuerpo:
   el spec habla de "archivo de audio", "Proveedor de Voz" e "interruptor por cuenta". El
   nombre del proveedor sobrevive solo dentro de la cita literal del `Input`, que es el pedido
   del usuario y no debe alterarse. El precio se expresa como un umbral verificable
   (SC-009: "menos de 1 dólar") en vez de una tarifa.

2. **FR-012 era ambiguo sobre el mecanismo.** Decía "no transcribir videos", lo que un lector
   razonable podía satisfacer filtrando por tipo de archivo — exactamente el error que la
   feature debe evitar, porque en un canal la nota de voz y el video comparten contenedor. Se
   reescribió para que el criterio sea explícito ("el tipo del mensaje MUST ser el único
   criterio") y se añadió FR-013 exigiendo la revalidación inmediatamente antes de llamar al
   proveedor. SC-002 lo hace medible con el dato real: 0 de 203 videos.

3. **Success criteria con métricas de sistema en vez de usuario.** "Latencia de transcripción
   bajo X ms" y "tasa de reintentos" se reemplazaron por SC-001 (tiempo hasta que el texto es
   legible por una persona) y SC-005 (la caída del proveedor no impide recibir ni responder
   mensajes), ambos verificables sin conocer la implementación.

### Observaciones para `/speckit-plan`

- **La dependencia declarada es bloqueante, no un "nice to have".** El vínculo entre el mensaje
  y su archivo de audio no se persiste hoy; sin repararlo, FR-016 (transcripción asociada al
  archivo) no es implementable. Debe resolverse antes, en su propio cambio, con reconstrucción
  del histórico.
- **FR-011/FR-012/FR-013 son el requisito de mayor riesgo de la feature.** Un incumplimiento no
  produce ningún error visible: solo gasto. Merece verificación dedicada y un test que no se
  borre en futuras simplificaciones.
- FR-010 (no transcribir retroactivamente al activar) existe para que nadie reciba un cargo
  sorpresa; la acción explícita de backfill debe quedar fuera del flujo normal.
