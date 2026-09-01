# Spec Kit en Karia — Feature vs Hotfix

Este documento formaliza dos flujos de trabajo sobre GitHub Spec Kit ya instalado en el proyecto (`.specify/`), a partir de un patrón que **ya se venía usando de forma orgánica** en `specs/` antes de este documento — acá solo se le pone nombre, se documenta cuándo usar cada uno, y se deja una plantilla concreta para que sea consistente de acá en adelante.

## Cómo funciona Karia hoy (contexto para este documento)

- **Next.js 16 App Router + TypeScript**, organizado por dominio de negocio bajo `src/` (`crm/`, `sales/`, `conversaciones/`, `integraciones/`, `ai/`, `automatizaciones/`), no por capa técnica — cada entidad trae sus propios `actions.ts` (Server Actions), `queries.ts` (Prisma), `schema.ts` (Zod), `components/`.
- **Multi-tenant**: toda query/mutación de negocio va scoped por `instanciaId` — es la regla de seguridad más repetida en las auditorías del proyecto (ver `docs/META-INSTAGRAM-PRODUCTION-AUDIT.md` §9).
- **Server-first**: Server Components + Server Actions; el cliente solo cuando hace falta interactividad. Validación con Zod en cada boundary del servidor.
- **Asíncrono por eventos**: efectos secundarios (mensajes salientes, notificaciones, IA) via RabbitMQ — un `worker` (`src/worker/disparadores.ts`) separado de la app Next.js corre los consumers (`src/suscriptores/`). Los webhooks entrantes de Meta llegan a la app Next.js y encolan comandos; el worker los procesa. Esto importa para Spec Kit porque **un mismo fix a veces toca dos servicios desplegables distintos** (App + Worker en Coolify) — ver `docs/META-FACEBOOK-MESSENGER-INTEGRACION.md` como ejemplo.
- **Integraciones de canal** (WhatsApp Lite/Business, Email, Instagram, Facebook Messenger) siguen un contrato común (`ICanalProvider`) registrado en `src/conversaciones/providers/registry.ts` — agregar o corregir un canal casi nunca toca los demás si se respeta ese contrato.
- **Spec Kit ya en uso**: 8 specs en `specs/001` a `specs/008` al momento de escribir esto. Sin buscarlo explícitamente, ya aparecen dos formas claramente distintas de spec:

  | # | Nombre | Forma |
  |---|---|---|
  | 001 | fix-cotizacion-dark-mode | Hotfix |
  | 002 | fix-pedido-flujo-dark-mode | Hotfix |
  | 003 | fix-scroll-position-nav | Hotfix |
  | 004 | fix-instagram-human-agent | Hotfix |
  | 005 | facebook-messenger-integracion | **Feature** |
  | 006 | fix-facebook-messenger-setup | Hotfix |
  | 007 | enriquecer-contacto-messenger | **Feature** |
  | 008 | fix-facebook-messenger-reacciones | Hotfix |

  El prefijo `fix-` en el nombre corto **ya era, sin que nadie lo escribiera como regla, el marcador de "esto es una corrección, no una funcionalidad nueva"**. Este documento adopta esa convención tal cual está, no inventa una nueva.

## Los dos flujos

### 🟢 Feature — funcionalidad nueva

**Cuándo**: el pedido agrega una capacidad que Karia no tenía (un canal nuevo, un dato nuevo que se muestra, una pantalla nueva). Ejemplo real: `005-facebook-messenger-integracion`.

**Nombre corto**: descriptivo, sin prefijo — `facebook-messenger-integracion`, `reportes-exportables-excel`.

**Ciclo completo, todos los artefactos son obligatorios**:

```
/speckit-specify → (/speckit-clarify si quedan ambigüedades reales) → /speckit-plan → /speckit-tasks → /speckit-implement
```

| Artefacto | Obligatorio | Notas |
|---|---|---|
| `spec.md` | Sí | User Stories con prioridad P1/P2/P3, cada una independientemente testeable/entregable |
| `checklists/requirements.md` | Sí (lo genera `/speckit-specify` solo) | Gate de calidad antes de planificar |
| `research.md` | Sí | Decisiones técnicas con Decision/Rationale/Alternatives — especialmente importante si hay integración externa (Meta, etc.) |
| `data-model.md` | Sí si hay datos involucrados | Puede decir explícitamente "sin entidades nuevas" si corresponde |
| `quickstart.md` | Sí | Guía de validación manual end-to-end |
| `tasks.md` | Sí | Organizado por historia de usuario, cada una con su propio checkpoint |

**MVP explícito**: la primera historia de usuario (P1) debe ser un incremento entregable por sí solo — no diseñar historias que solo tienen sentido todas juntas.

---

### 🔴 Hotfix — corrección de una incidencia

**Cuándo**: algo que Karia ya hace, no funciona como debería (un bug, una integración rota, un dato que no se completa, una regresión). El usuario suele describirlo como síntoma ("no me deja...", "no se ve...", "me falla..."), no como una capacidad nueva. Ejemplos reales: `004`, `006`, `008`.

**Nombre corto**: prefijo `fix-` + descripción corta del síntoma — `fix-facebook-messenger-reacciones`, no `mejora-de-reacciones`.

**Ciclo abreviado — el objetivo es diagnóstico certero antes que ceremonia**:

```
/speckit-specify (con Diagnóstico previo obligatorio) → /speckit-plan (liviano) → /speckit-tasks (mínimo, 1-2 tareas si el fix es chico) → /speckit-implement
```

`/speckit-implement` exige que `tasks.md` exista (no se puede saltar ese paso), así que la diferencia real con Feature no es "sin tasks.md" sino "tasks.md mínimo, sin las fases de Setup/Foundational/Polish si no aportan nada para un fix de 1-3 archivos".

| Artefacto | Obligatorio | Notas |
|---|---|---|
| `spec.md` | Sí, **con sección "Diagnóstico previo" como primer contenido**, antes de User Scenarios | Investigar la causa raíz en el código *antes* de escribir requerimientos — ver plantilla abajo. Si la investigación no encuentra una causa clara y acotada, probablemente no es un Hotfix sino que hace falta un Feature de diagnóstico (ver `004`) |
| `checklists/requirements.md` | Sí | Mismo gate que Feature — un hotfix mal especificado igual sale caro |
| `research.md` | Solo si hay una decisión técnica real que documentar (ej. contra qué API de Meta se confirmó algo). Si la causa y la solución ya quedaron claras en el Diagnóstico previo, se puede omitir explicando por qué |
| `data-model.md` | Solo si cambia algo del modelo de datos — muchas veces es "sin entidades nuevas", una línea |
| `quickstart.md` | Sí, pero corto — 2 a 5 escenarios, **uno siempre debe ser "cero regresión" sobre lo que ya funcionaba** |
| `tasks.md` | **Siempre existe, pero puede ser mínimo** — `/speckit-implement` exige `tasks.md` (`check-prerequisites.sh --require-tasks` falla sin él, verificado en `006`), así que no se puede saltar del todo. Para un fix de 1-3 archivos con un solo cambio claro, alcanza con 1-2 tareas sin fases de Setup/Foundational (ver `006`). Si el fix tiene más de una dirección/historia independiente, generar el `tasks.md` completo por historia (ver `008`: envío y recepción de reacciones eran independientes) |

**Requisito no negociable en cada Hotfix**: al menos un Functional Requirement explícito de tipo *"El sistema MUST NOT alterar el comportamiento existente de X"* — el riesgo #1 de un hotfix es arreglar una cosa y romper otra que ya andaba.

**Plantilla del Diagnóstico previo** (va como sección propia, antes de `## User Scenarios & Testing`):

```markdown
## Diagnóstico previo (investigación de código [+ documentación externa si aplica])

- Qué se investigó y dónde (archivo:línea o endpoint de Meta consultado)
- Qué se confirmó que SÍ funciona (para no tocarlo)
- La causa raíz exacta — con evidencia, no una suposición
- Por qué el síntoma reportado se explica por esa causa y no por otra
```

## Decisión rápida: ¿Feature o Hotfix?

```
¿Karia ya hacía esto y dejó de funcionar / nunca funcionó bien?
├── Sí → Hotfix (fix-...)
└── No, es algo que Karia nunca tuvo → Feature
```

Casos límite ya resueltos en este proyecto:
- *"Facebook Messenger no completa el nombre del contacto, como sí hace Instagram"* → pareció un fix, pero Messenger nunca tuvo esa capacidad (`007`) → **Feature**, no Hotfix.
- *"Las reacciones se guardan en Karia pero no llegan a Facebook"* → Karia sí pretendía enviarlas y el código para hacerlo faltaba/estaba mal → **Hotfix** (`008`).

Si dudás, preguntá: "¿esto ya se había prometido/mostrado como funcionando y ahora no lo hace?" — si la respuesta es sí, es Hotfix.

## Numeración y ramas

- Numeración secuencial única en `specs/NNN-...` para ambos flujos (no hay una numeración separada para hotfixes) — es lo que ya hace `create-new-feature.sh` y no hay razón para complicarlo.
- Sin automatización de creación de rama todavía (`.specify/extensions.yml` no existe en este proyecto) — las ramas se crean a mano hoy. Si en el futuro se agrega el hook `git` de Spec Kit, la convención debería ser `feature/NNN-slug` y `hotfix/NNN-slug` para que quede visible también en `git branch`.

## El workflow declarativo (`.specify/workflows/`)

Además de la convención de arriba (que aplica corriendo los comandos `/speckit-*` en orden manualmente, como se hizo en `001`-`008`), este proyecto tiene el motor de workflows de Spec Kit instalado (`.specify/workflows/workflow-registry.json`), con un workflow `speckit` bundled (Feature: specify → plan → tasks → implement, con gates de revisión).

Se agregó un segundo workflow, **`hotfix`** (`.specify/workflows/hotfix/workflow.yml`), reflejando el ciclo abreviado de arriba (specify → plan → gate de revisión → implement, sin paso de `tasks` obligatorio). **No pude verificar que el runner de workflows esté expuesto como comando en este entorno de Claude Code** — si tu instalación de la CLI `specify` sí lo soporta (`specify workflow run hotfix "..."` o equivalente), probalo y contame para documentar el comando exacto acá. Mientras tanto, seguir la secuencia manual de comandos `/speckit-*` de la tabla de arriba logra exactamente lo mismo.

## Mejora continua

Este documento se actualiza, no se re-escribe desde cero:

1. **Cada vez que un Hotfix o Feature revele un patrón nuevo que valga la pena repetir** (como pasó acá con "Diagnóstico previo", que nació en `004` y ya se volvió estándar en `006`/`008`), se agrega a este documento en la próxima sesión de Spec Kit, citando el spec que lo originó.
2. **Cada vez que un artefacto resulte innecesario dos veces seguidas** (por ejemplo, si `research.md` termina vacío/trivial en varios Hotfix seguidos), se reconsidera si debería dejar de ser obligatorio para ese flujo.
3. Si aparece un tercer patrón claramente distinto de Feature/Hotfix (por ejemplo, tareas puramente de infraestructura/DevOps sin código de producto), se documenta como un tercer flujo acá en vez de forzarlo dentro de los dos existentes.

Referenciado desde `CLAUDE.md` para que sea parte de la guía que ya se consulta al trabajar en el proyecto.
