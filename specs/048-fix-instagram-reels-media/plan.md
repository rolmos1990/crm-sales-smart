# Implementation Plan: Reels, publicaciones e historias de Instagram que llegan vacías o con la URL de Meta

**Branch**: `fix/048-instagram-reels-media` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/048-fix-instagram-reels-media/spec.md`

**Tipo**: Hotfix, con plan liviano (ver `docs/SPEC-KIT-WORKFLOWS.md`).

## Summary

El webhook de Instagram/Messenger hoy:
- Convierte en `TEXTO` vacío todo adjunto que no sea `image`, `video`, `audio` o `file`.
- Deja la URL del CDN de Meta en `mediaUrl`.

Los videos directos sí se guardan, pero en el inbox solo se ve la palabra "Video".

El fix, según el alcance decidido el 2026-11-20 (research R0):
1. **Nunca una URL de Meta** (P1): invariante único en el webhook antes de encolar, más una migración de datos para el histórico.
2. **Videos directos reproducibles y bien vistos** (P2):
   - Reproductor nativo en la burbuja, con vista previa, proporción respetada, `playsInline` y aviso con descarga si el formato no se puede reproducir.
   - Soporte de `Range` en el proxy `/cdn`, para Safari/iOS y para adelantar.
3. **Reels, publicaciones e historias identificables** (P3):
   - Clasificación por familia y texto descriptivo en `contenido`.
   - Los Reels y las historias de video son **solo texto**, sin descarga.
   - Las publicaciones e historias de foto guardan la imagen.

Sin cambios de esquema ni de contratos de eventos. Sin dependencias nuevas.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 15 (App Router, route handlers), Prisma 7, React 19, Tailwind v4 / shadcn. Sin dependencias nuevas.

**Storage**:
- PostgreSQL: solo migración de datos.
- Storage de media existente, vía `subirImagenConversacion` y `guardarArchivoRaw`.

**Testing**: Vitest para:
- La clasificación de familias.
- La decisión de reubicación.
- El parseo y recorte de `Range`.
- Los providers de Instagram y Messenger.

Más el quickstart manual contra Meta y en varios navegadores.

**Target Platform**: servidor Node (app Next.js en Coolify) y navegadores Chrome, Edge, Firefox y Safari (escritorio, iOS y Android). El worker no cambia.

**Project Type**: web-service + UI web (monolito Next.js)

**Performance Goals**:
- Adelantar un video sin descargarlo completo en el cliente.
- Las descargas nuevas (solo imágenes) tienen un tope de 15 s.

**Constraints**:
- 50 MB máximo y la lista blanca de mimes vigente.
- Nunca persistir hosts de Meta.
- Aislamiento por `instanciaId`.
- Descarga de media directa sin cambios (FR-010).

**Scale/Scope**: unos 7 archivos de código, 1 migración de datos y 4 archivos de tests.

## Constitution Check

| Principio | Evaluación |
|---|---|
| I. Arquitectura modular | ✅ La clasificación vive en `src/conversaciones/providers/`. La UI no toca Prisma. Se extienden los servicios de media y el proxy existentes. |
| II. Reglas en el servidor | ✅ El invariante "sin URL de Meta" se aplica en el webhook. |
| III. Datos y eventos confiables | ✅ Sin cambio en contratos de eventos. Idempotencia por `mid` intacta. El fallo de un adjunto no corta el lote. La migración es idempotente. |
| IV. Integraciones reemplazables | ✅ Los strings de Meta quedan dentro del provider de Instagram. Timeout explícito en las descargas nuevas y degradación segura a texto. |
| V. Seguridad y calidad | ✅ Storage aislado por instancia. El proxy `/cdn` mantiene su validación de path traversal y solo agrega `Range` sobre el mismo archivo. Tests proporcionales. Quickstart con cero regresión y matriz de navegadores. |
| Restricciones técnicas | ✅ Sin dependencias nuevas (se rechazó ffmpeg, ver R0). Migración versionada, no destructiva sobre datos propios. UI responsive (vertical y horizontal, móvil). |

**Resultado**: pasa sin excepciones. Re-evaluado después del diseño: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/048-fix-instagram-reels-media/
├── spec.md
├── plan.md                      # este archivo
├── research.md                  # R0–R7
├── data-model.md                # sin entidades nuevas; invariante de mediaUrl
├── quickstart.md                # escenarios 0–5 (matriz de navegadores + cero regresión)
├── contracts/
│   └── texto-descriptivo.md
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
src/conversaciones/providers/
├── instagram-adjuntos.ts          # NUEVO — clasificarAdjuntoInstagram() (familias R1) + textos (contrato)
├── instagram-adjuntos.test.ts     # NUEVO
├── instagram.ts                   # mapearEntrante: usa la clasificación; Reel/efímero/no admitido sin mediaUrl; lee reply_to.story
├── instagram.test.ts              # + casos de Reel, publicación, mención, respuesta y no admitido
├── facebook-messenger.ts          # default: sin mediaUrl + texto genérico (FR-011)
└── facebook-messenger.test.ts     # + caso sticker/share sin URL

src/conversaciones/types.ts        # MensajeEntranteNormalizado: + campo interno opcional `familiaAdjunto`
                                   #   (solo provider → webhook; se elimina antes de publicar)

src/app/api/webhooks/instagram/
├── route.ts                       # reubicación sin filtro por tipo; publicaciones/historias: solo image/*,
│                                  #   Content-Type antes del cuerpo, 15 s; directa sin cambios; invariante antes de publicar
├── reubicacion.ts                 # NUEVO — decisión pura: (normalizado, resultadoDescarga) → payload final
└── reubicacion.test.ts            # NUEVO

src/app/cdn/[...key]/
├── route.ts                       # Range → 206 / Accept-Ranges / Content-Range; 416 si el rango es inválido
├── range.ts                       # NUEVO — parseo puro del header Range
└── range.test.ts                  # NUEVO

src/conversaciones/components/burbuja-mensaje.tsx
                                   # BurbujaVideo (preview #t=0.1, playsInline, proporción, onError → aviso + descarga);
                                   # media + contenido juntos para IMAGEN/VIDEO

prisma/migrations/2026112X000100_limpiar_urls_meta_mensajes/migration.sql   # R7, solo datos
```

**Structure Decision**: se respeta la organización por dominio. La lógica de canal queda en `providers/`. La orquestación de descarga queda en el webhook, extraída a una función pura. El parseo de `Range` también es puro y testeable. La UI queda en `conversaciones/components/`.

## Decisiones de diseño clave (detalle en research.md)

1. **Alcance R0**:
   - Reels e historias de video: solo texto, sin descarga.
   - Publicaciones e historias de foto: imagen.
   - Video directo: reproducible.
2. **Sin enum nuevo**: `tipo` = lo conservado; qué se compartió va en `contenido` (R2).
3. **Invariante único en el webhook** para ambos comandos y ambos canales (R5).
4. **Descarga directa intacta**. Lo único nuevo que se descarga son imágenes, verificadas por `Content-Type` antes de leer el cuerpo (R6).
5. **Burbuja**: media arriba y texto abajo cuando hay ambos. **Cambio consciente**: un saliente con imagen y texto pasa a mostrar también la imagen, que hoy se oculta (R3).
6. **Video**: controles nativos sin librería, `Range` en `/cdn`, preview con `#t=0.1`, proporción con `object-contain` y fallback de descarga (R4).

## Riesgos

- **Meta no envía el título del Reel**: el vendedor ve "Compartió un Reel" sin saber cuál. Es un límite aceptado de la opción "solo texto" (Assumptions del spec).
- **Forma del payload distinta de la documentada**: familias tolerantes, degradación a texto genérico y validación en el escenario 0 del quickstart.
- **`Range` sobre un buffer completo**: el servidor sigue descargando el archivo entero del bucket en cada petición parcial. Funciona, pero cuesta memoria con videos grandes. El streaming desde S3 queda como mejora futura si se nota.
- **Formatos no reproducibles** (`.mov` en Chrome/Firefox): mitigado con aviso y descarga. Convertir formatos está fuera de alcance.

## Complexity Tracking

Sin violaciones a la constitución. No aplica.
