# Implementation Plan: El filtro anti-citas deja de rechazar frases comerciales corrientes

**Branch**: `fix/052-filtro-citas-analisis` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/052-fix-filtro-citas-analisis/spec.md`

**Tipo**: **Hotfix**. El análisis de contactos ya existía y ya prometía evaluar cada contacto; un
control interno demasiado estricto lo rompe en el 5,8 % de los casos. Plan liviano según
`docs/SPEC-KIT-WORKFLOWS.md`, con el requisito explícito de no alterar lo que ya funcionaba.

**Base**: `main` @ `f1271c5`, que ya incluye 050 (#45) y 051 (#46).

## Summary

`copiaDeFuente` (`src/ai/analisis-contactos/salida.ts:85`) rechaza cualquier texto de la IA que
comparta **25 caracteres seguidos** con los mensajes de la conversación. El objetivo es impedir
que la IA copie textualmente lo que escribió el cliente (FR-017a de 042), pero 25 caracteres de
español corriente los alcanza cualquier resumen fiel: *"Pregunta el precio de las esferas"*
comparte 26 con *"¿me das el precio de las esferas?"*.

**El umbral está mal elegido y se puede demostrar con los datos que ya hay.** Los 1284 textos
libres de 400 evaluaciones aceptadas tienen solape máximo **24** — exactamente uno menos que el
umbral. Eso no dice que 25 sea holgado: dice que la muestra está **censurada por el propio
umbral**. Los rechazados caen en **26–29**. No hay hueco entre ambos grupos.

Tres cambios, todos en validación; **ninguno toca el prompt, el contexto ni lo que se guarda en
el contacto**:

1. **El umbral sube de 25 a 40.** Margen de ~38 % sobre el peor falso positivo medido (29), y muy
   por debajo de lo que mide una cita real —una oración entera—, dentro del tope de 120
   caracteres que estos campos ya tienen.
2. **El filtro deja de devolver un booleano y devuelve el motivo.** Hoy correo, URL, dígitos,
   dirección y cita comparten un `true` indistinguible; eso es lo que obligó a reconstruir el
   pipeline y volver a llamar a la IA contacto por contacto para saber cuál había sido.
3. **Ese motivo se guarda en la fila de auditoría**, que ya tiene una columna de texto libre para
   el código de error. Sin cambios de esquema.

Lo que **no** cambia: correos, URLs, secuencias de 7+ dígitos y direcciones se siguen rechazando
igual; una cita larga de verdad se sigue rechazando; la cola, los reintentos, el puntaje, el
consumo de IA y las reglas quedan intactos. Los 7 contactos fallidos se recuperan con el botón de
reintento que la pantalla **ya tiene**: no se construye nada para eso.

Sin dependencias nuevas. Sin migración.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Zod v4, Prisma 7. **Sin dependencias nuevas.**

**Storage**: PostgreSQL. **Cero cambios de esquema.**
`EjecucionAnalisisContactosItem.errorCodigo` ya es `String?` sin enum
(`prisma/schema.prisma:1053`), así que admite el motivo fino sin migrar nada.

**External**: ninguno nuevo. El diagnóstico se validó llamando a DeepSeek con el pipeline real,
pero la implementación no agrega llamadas: es validación de la respuesta.

**Testing**: Vitest sobre `salida.ts`, que ya tiene batería de casos de privacidad
(`salida.test.ts:85-110`). Se agregan los casos del umbral nuevo y de los motivos. Verificación
contra producción: revalidar los 1284 textos ya aceptados y los 5 rechazados del diagnóstico.

**Target Platform**: el análisis corre en el **worker**. La pantalla de configuración solo
muestra el avance y ofrece el reintento.

**Project Type**: Web application (Next.js App Router) + worker Node.

**Performance Goals**: sin impacto. `copiaDeFuente` recorre ventanas del texto de salida; con un
umbral mayor hace **menos** iteraciones, no más.

**Constraints**:
- Correos, URLs, dígitos y direcciones: rechazados igual que hoy (FR-004).
- Una cita textual larga: rechazada igual que hoy (FR-005).
- Los 1284 textos ya aceptados siguen aceptándose (FR-003).
- El registro del motivo **no** puede contener el texto generado ni fragmentos de la conversación
  (FR-007).
- La IA sigue sin escribir hechos ni "No contactar" (FR-009).

**Scale/Scope**: 1612 evaluaciones aceptadas y 99 rechazadas en el histórico; 7 contactos en
estado fallido.

## Constitution Check

*GATE: pasa antes de Phase 0 y se vuelve a evaluar después de Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Modular Business Architecture** | El cambio vive en `src/ai/analisis-contactos/salida.ts` —el módulo dueño de la validación— más el punto del motor que escribe la auditoría. No se crea ninguna abstracción nueva. | ✅ |
| **II. Server-Enforced Business Rules** | La validación de la salida de la IA es, literalmente, la regla de servidor que protege lo que se guarda. Se **endurece su trazabilidad** y no se afloja ningún control de forma reconocible. | ✅ |
| **III. Reliable Data and Events** | Sin escrituras nuevas, sin eventos, sin transacciones. La recuperación reutiliza `reintentarFallidos`, que ya es idempotente. | ✅ |
| **IV. Replaceable Integrations** | **"AI output MUST NOT bypass deterministic rules, permissions, or validation"**: la validación se mantiene y se vuelve auditable. Ningún tipo del proveedor entra en el dominio. | ✅ |
| **V. Security and Quality (NON-NEGOTIABLE)** | **El punto delicado del hotfix**: se relaja un control de privacidad. Se relaja con medición, no por corazonada, y solo en la regla de *cita* — las de forma reconocible (correo, URL, dígitos, dirección) no se tocan. FR-007 impide que el motivo registrado filtre contenido. Tests proporcionales: la batería de privacidad existente se amplía. | ✅ |
| **Technical Constraints** | Stack aprobado, sin dependencias, **sin migración**. | ✅ |
| **Development Workflow** | Spec con diagnóstico reproducido, causa raíz medida, alcance acotado y exclusiones explícitas. | ✅ |

**Resultado: pasa sin violaciones.** No se completa la tabla de Complexity Tracking.

> **Anotado para la revisión**: este hotfix **afloja** un control de privacidad. La defensa es que
> el control no estaba protegiendo lo que parecía —los cinco rechazos reales eran nombres de
> producto y frases comerciales— y que el número nuevo sale de medir 1284 casos, no de estimar.
> La protección contra la copia textual de un mensaje del cliente sigue en pie.

**Re-evaluación post-Phase 1**: el diseño no agregó capas ni dependencias. Un tipo de retorno
cambia de `boolean` a un motivo, una constante sube de 25 a 40 y un campo que ya existía pasa a
llenarse con más detalle. Sigue pasando.

## Project Structure

### Documentation (this feature)

```text
specs/052-fix-filtro-citas-analisis/
├── plan.md                    # Este archivo
├── research.md                # Phase 0: 5 decisiones
├── data-model.md              # Phase 1: qué se lee y escribe (sin cambios de esquema)
├── quickstart.md              # Phase 1: verificación, incluida la revalidación masiva
├── contracts/
│   └── filtro-privacidad.md   # Phase 1: contrato del filtro y de la auditoría
├── checklists/requirements.md # Checklist del spec (16/16)
└── tasks.md                   # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/ai/analisis-contactos/
├── salida.ts           # MODIFICADO — LARGO_CITA 25→40; `contieneDatosPrivados` devuelve
│                       #   el motivo; `validarSalidaLote` lo propaga por contacto
└── salida.test.ts      # MODIFICADO — casos del umbral nuevo y de cada motivo

src/crm/contactos/analisis/
├── types.ts            # MODIFICADO — el motivo viaja en RespuestaLoteIA
└── motor/ejecutor.ts   # MODIFICADO — escribe el motivo en el item de auditoría

docs/analisis-contactos.md   # MODIFICADO — el umbral, su medición y por qué no se baja
```

**Structure Decision**: el arreglo vive donde vive la regla. `salida.ts` es el único lugar que
decide si una evaluación se acepta, y el ejecutor solo transporta el motivo hasta la fila de
auditoría. No se agrega un módulo de "motivos de rechazo": son un tipo de unión en el mismo
archivo que los produce, igual que `CodigoErrorVoz` vive junto a los proveedores de voz.

## Phase 0 — Research

Completo en [research.md](./research.md). Cinco decisiones:

1. El umbral sube a 40, y el número sale de la medición (con el argumento de la muestra censurada).
2. El filtro devuelve el motivo en vez de un booleano — **sí se separa "cita" del resto**, que es
   la pregunta que dejó abierta el checklist del spec.
3. El motivo se guarda en `item.errorCodigo`, que ya es texto libre: cero cambios de esquema.
4. El código a nivel **ejecución** sigue siendo `RESPUESTA_INVALIDA`.
5. La recuperación de los 7 fallidos usa `reintentarFallidos`, que ya existe: no se construye nada.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — qué se lee y qué se escribe; **ningún cambio de esquema**.
- [contracts/filtro-privacidad.md](./contracts/filtro-privacidad.md) — firmas, motivos, invariantes
  y casos borde.
- [quickstart.md](./quickstart.md) — verificación, con la revalidación masiva contra los 1284
  textos aceptados como prueba central de no-regresión.
