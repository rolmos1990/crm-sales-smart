# Implementation Plan: El nombre del archivo deja de impedir la transcripción

**Branch**: `fix/051-nombre-archivo-voz` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/051-fix-nombre-archivo-voz/spec.md`

**Tipo**: **Hotfix**. Karia ya transcribía notas de voz y lo hacía bien con ElevenLabs; cambiar
de proveedor lo rompió. Plan liviano según `docs/SPEC-KIT-WORKFLOWS.md`, con el requisito
explícito de no alterar lo que ya funcionaba (FR-005/006/007).

**Base**: `main` @ `b0949f7`. **Independiente de 050** —que está en su propia rama y toca
`src/configuracion/voz/`—: este hotfix toca `src/voz/` y no se cruzan en ningún archivo.

## Summary

Groq y OpenAI deciden si aceptan un audio **por la extensión del nombre** que viaja en el
formulario. `src/voz/transcribir.ts:123` les manda `media.nombreOriginal` tal cual, y ese nombre
no trae extensión. Groq responde `400 unsupported_audio_format`, `groq.ts:76` lo traduce a un
fallo **permanente** —correcto para un formato inválido, falso acá— y el audio queda en `ERROR`
al primer intento, para siempre.

**El problema es universal, no de Instagram.** Los 744 `MediaArchivo` ligados a un mensaje
`AUDIO`/`NOTA_VOZ` en producción tienen `nombreOriginal` **sin extensión**, los 738 de Instagram
y también los 6 de WhatsApp (`audio/ogg; codecs=opus`). Hasta ahora no se notaba porque
ElevenLabs identifica el formato por el contenido.

**La solución no necesita un mapa de mime a extensión: ya está en la clave de storage.** Los
mismos 744 archivos tienen `keyOriginal` terminada en `.mp4` o `.ogg` — la extensión que el
propio sistema les asignó al guardarlos, con `extDesde(mime)`
(`src/lib/media/services/media-raw.service.ts:49`). Tomarla de ahí evita una segunda lista que
se arregle por separado, y resuelve gratis el caso del mime con parámetros.

Dos cambios:

1. **El arreglo** — una función pura que compone el nombre con su extensión, aplicada en
   `transcribir.ts` antes de llamar a cualquier proveedor. Un solo punto, y un test que fija el
   invariante para todos los proveedores presentes y futuros.
2. **La recuperación** — un script puntual que devuelve a la cola las notas que murieron por
   **esta** causa, distinguiéndola por el código funcional que ya guarda `UsoVoz`.

Sin dependencias nuevas. Sin cambios de esquema. Sin migración.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Prisma 7, Node 20 (`FormData`/`Blob` globales). **Sin dependencias nuevas.**

**Storage**: PostgreSQL. **Cero cambios de esquema.** Se leen `MediaArchivo` y `UsoVoz` como están.

**External**: Groq y OpenAI Speech-to-Text (`POST /v1/audio/transcriptions`). El
comportamiento que motiva el hotfix —validación por extensión— está **reproducido contra la API
real de Groq**, no inferido de la documentación (ver [research.md](./research.md) Decisión 1).

**Testing**: Vitest sobre la función pura de composición del nombre y sobre el invariante de que
lo que llega al proveedor siempre lleva extensión. Verificación manual del flujo completo y de la
recuperación en [quickstart.md](./quickstart.md).

**Target Platform**: la transcripción corre **solo en el worker**
(`src/worker/disparadores.ts`). El script de recuperación se ejecuta a mano.

**Project Type**: Web application (Next.js App Router) + worker Node.

**Performance Goals**: sin impacto. El arreglo es una operación de cadena por audio.

**Constraints**:
- ElevenLabs no cambia de comportamiento (FR-005).
- Un formato genuinamente no admitido sigue fallando de forma definitiva (FR-006).
- La cola, el backoff, el tope diario, el registro de uso y la decisión de inaudible quedan
  intactos (FR-007).
- La recuperación simula por defecto y exige confirmación explícita (FR-009).

**Scale/Scope**: 744 audios en producción, 3 en `ERROR`, de los cuales **1** por esta causa.

## Constitution Check

*GATE: pasa antes de Phase 0 y se vuelve a evaluar después de Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Modular Business Architecture** | El arreglo vive en `src/voz/`, el módulo dueño del problema. No se toca `src/lib/media/`: la extensión se lee de la clave que ese módulo ya produjo, sin importar su lógica interna. | ✅ |
| **II. Server-Enforced Business Rules** | Sin entrada de usuario que validar. La recuperación reutiliza las guardias de `marcarPendiente`, que ya filtra por `instanciaId` y por tipo de mensaje en el propio SQL. | ✅ |
| **III. Reliable Data and Events** | La recuperación es idempotente: una segunda corrida no encuentra nada. No puede arrebatar un audio en `PROCESANDO` ni resucitar uno `LISTO`/`INAUDIBLE` — esa guardia ya existe en `cola.ts:55`. | ✅ |
| **IV. Replaceable Integrations** | **Este hotfix sirve directamente al principio.** Hoy la lógica de negocio depende de una peculiaridad del proveedor: con ElevenLabs transcribe, con Groq no. El arreglo elimina esa dependencia. | ✅ |
| **V. Security and Quality (NON-NEGOTIABLE)** | La recuperación va por tenant. Ningún cambio toca credenciales ni logs. Tests unitarios sobre la función pura y el invariante de alcance. | ✅ |
| **Technical Constraints** | Stack aprobado, sin dependencias, **sin migración**. | ✅ |
| **Development Workflow** | Spec con diagnóstico, causa raíz **reproducida**, alcance acotado y exclusiones explícitas. | ✅ |

**Resultado: pasa sin violaciones.** No se completa la tabla de Complexity Tracking.

**Re-evaluación post-Phase 1**: el diseño no agregó capas ni abstracciones — una función pura, un
parámetro opcional en una función existente y un script. Sigue pasando.

## Project Structure

### Documentation (this feature)

```text
specs/051-fix-nombre-archivo-voz/
├── plan.md                    # Este archivo
├── research.md                # Phase 0: 5 decisiones
├── data-model.md              # Phase 1: qué se lee (sin cambios de esquema)
├── quickstart.md              # Phase 1: verificación manual
├── contracts/
│   └── nombre-archivo.md      # Phase 1: contrato de la función y de la recuperación
├── checklists/requirements.md # Checklist del spec (16/16)
└── tasks.md                   # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/voz/
├── nombre-archivo.ts          # NUEVO — compone nombre + extensión (función pura)
├── nombre-archivo.test.ts     # NUEVO — casos borde de la composición
├── transcribir.ts             # MODIFICADO — una línea: el nombre que se le pasa al proveedor
├── transcribir.nombre.test.ts # NUEVO — el invariante: lo que llega al proveedor SIEMPRE
│                              #   lleva extensión, con cualquier proveedor
└── cola.ts                    # MODIFICADO — `marcarPendiente` acepta reiniciar los intentos

scripts/
└── 051-recuperar-formato-no-soportado.ts   # NUEVO — recuperación, simula por defecto
```

**Structure Decision**: el arreglo va en `src/voz/`, no en `src/voz/proveedores/`. El problema no
es de un proveedor: es que el nombre que el módulo entrega está mal formado. Defenderse de eso en
cada adaptador obliga a recordarlo cada vez que se agregue uno —y el que se olvide falla igual
que hoy—. El script sigue la convención de `scripts/049-backfill-transcripciones.ts`.

## Phase 0 — Research

Completo en [research.md](./research.md). Cinco decisiones:

1. La extensión sale de `keyOriginal`, no de un mapa nuevo de mime a extensión.
2. El arreglo va en `transcribir.ts`, un solo punto, no en cada adaptador.
3. `FORMATO_NO_SOPORTADO` sigue siendo permanente — no se relaja.
4. La recuperación distingue la causa por el código funcional de `UsoVoz`.
5. `marcarPendiente` gana un parámetro opcional para reiniciar los intentos, en vez de que el
   script duplique sus guardias.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — qué se lee y qué invariantes se asumen. **Sin cambios de esquema.**
- [contracts/nombre-archivo.md](./contracts/nombre-archivo.md) — firma, reglas y casos borde de
  `nombreConExtension`, el invariante de `transcribir.ts` y el contrato del script.
- [quickstart.md](./quickstart.md) — verificación del arreglo, de la recuperación y de la
  no-regresión en ElevenLabs.
