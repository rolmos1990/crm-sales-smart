# Implementation Plan: Vista segura de correos HTML en el Inbox

**Branch**: `feature/035-correo-html-seguro` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-correo-html-seguro/spec.md`

## Summary

Mostrar el HTML de los correos entrantes con su diseño original sin que pueda tocar Karia. El enfoque tiene
tres capas independientes. Basta con que **una** se mantenga en pie para que un correo malicioso no tenga
efecto.

1. **Limpieza al recibir.** Se hace en el worker con `sanitize-html` y una política de lista blanca, con
   límites de tamaño, profundidad y tiempo. Solo se guarda el HTML limpio, en una tabla nueva
   `MensajeCorreo` (1 a 1 con el mensaje y con `instanciaId`). Al servir se **vuelve a limpiar** con la
   misma política.
2. **Aislamiento del navegador.** El correo se ve en un iframe con sandbox: sin scripts, sin mismo origen,
   sin formularios y sin navegación de la ventana principal. El documento se sirve desde una ruta propia
   con CSP restrictiva por cabecera, que incluye la directiva `sandbox`, más `nosniff`, `no-referrer` y
   `no-store`.
3. **Autorización por token.** La vista y sus imágenes se autorizan con un token HMAC de 15 minutos,
   emitido por una ruta con sesión que verifica el comercio. La ruta del token **vuelve a verificar** el
   comercio contra la base de datos.

Las imágenes externas quedan bloqueadas por defecto. Si el agente las carga, pasan por un proxy con
protección SSRF: DNS validado y fijado, `net.BlockList`, redirecciones revalidadas, topes, solo imágenes
de mapa de bits y re-codificación con `sharp`. Las imágenes `cid:` salen de los adjuntos que Karia ya
guarda. Además se guardan las cabeceras reales de cada correo (De, Para, CC, fecha y asunto).

No se agrega infraestructura. La única dependencia nueva es `sanitize-html`.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js App Router (`next ^15.5` según `package.json`), React 19.2, Prisma 7 +
PostgreSQL, RabbitMQ, TanStack Query v5, shadcn/ui, `mailparser` (ya instalado), `sharp` (ya instalado).
**Nueva**: `sanitize-html` (+ `@types/sanitize-html`). Justificación en [research.md](./research.md) R1.

**Storage**: PostgreSQL, con una tabla nueva `MensajeCorreo` y un enum `EstadoHtmlCorreo` (migración
aditiva). Los adjuntos y las imágenes cid quedan en el storage de media existente
(`IStorageProvider.download`).

**Testing**:
- Vitest:
  - catálogo de limpieza (14 casos);
  - catálogo SSRF (16 casos);
  - token;
  - documento y cabeceras;
  - rutas con 404 cruzado entre comercios;
  - `normalizar.test.ts`, que reemplaza la regla de la línea 51;
  - grafo de imports del worker.
- Playwright: correo malicioso en el Inbox (sin ejecución, sin peticiones externas, sin navegación de la
  ventana principal, atributos del sandbox y cabeceras CSP).
- Verificación manual en un navegador real ([quickstart.md](./quickstart.md) §3).

**Target Platform**: app Next.js (rutas de vista, de imágenes y proxy) y worker con `tsx` (limpieza al
recibir).

**Project Type**: aplicación web multi-tenant con worker de background.

**Performance Goals**:
- Vista previa en menos de 1 s tras expandir (SC-003): una consulta, una segunda limpieza de ≤ 512 KB y un
  documento.
- Limpieza de entrada de ≤ 2 s medidos y ≤ 5 s por correo en el peor caso (SC-004).

**Constraints**:
- **Nunca** `allow-scripts` ni `allow-same-origin`.
- **Nunca** HTML del correo en el DOM de Karia: ni `dangerouslySetInnerHTML` ni `srcdoc`.
- **Nunca** guardar el HTML original.
- Entrada de ≤ 1 MB, salida de ≤ 512 KB, ≤ 50 imágenes externas y ≤ 20 imágenes en línea.
- Proxy: 5 s, 5 MB y 3 redirecciones.
- WhatsApp, Instagram y Messenger, la consulta compartida de mensajes y el envío SMTP no cambian.

**Scale/Scope**: mismo volumen de correo que 034 (hasta 50 buzones por ciclo). Hay 4 historias de
usuario; se tocan unos 10 archivos existentes y se crean unos 20.

## Constitution Check

*GATE: se revisa antes de la Fase 0 y otra vez después de la Fase 1.*

| Principio | Cumplimiento |
|---|---|
| **I. Arquitectura modular** | ✅ Todo vive en `src/integraciones/email/` (`mensaje/html/` para la limpieza, `vista/` para token, documento y proxy) y en rutas `src/app/api/correo*`. Los componentes de React no tocan Prisma: piden datos por la ruta con sesión |
| **II. Reglas en el servidor** | ✅ La limpieza, la autorización por comercio, la firma del token y la validación SSRF ocurren en el servidor. El navegador solo recibe URLs firmadas e índices, nunca URLs externas. Los JSON se validan con Zod al leer y al escribir |
| **III. Datos y eventos confiables** | ✅ `MensajeCorreo` se crea en el mismo `create` atómico del mensaje. El reproceso es idempotente (deduplicación por `idExterno` y `mensajeId @unique`). El contrato `ProcesarEntrante` solo crece con un campo opcional, sin evento nuevo. El guardado de cabeceras de salida no puede tumbar un envío |
| **IV. Integraciones reemplazables** | ✅ `mailparser` sigue encapsulado en `normalizar.ts`. `sanitize-html` queda detrás de `limpiar-html.ts`. El storage se usa por `IStorageProvider`. El proxy tiene timeouts, topes y degradación a "imagen no disponible" |
| **V. Seguridad y calidad** | ✅ Todas las rutas filtran por `instanciaId` y devuelven 404 en cualquier discrepancia. Ninguna credencial ni contenido de correo va a los logs. Hay pruebas proporcionales al riesgo: catálogos de seguridad unitarios, rutas, e2e y navegador real |
| **Dependencias nuevas** | ✅ Solo `sanitize-html`: no existía ninguna capacidad equivalente en el proyecto (research R1) |
| **Migraciones** | ✅ Aditiva, sin backfill y con reversión documentada ([data-model.md](./data-model.md)) |
| **UI responsive y accesible** | ✅ El iframe tiene `title`. El selector es accesible con teclado. Hay vista ampliada en un `Dialog`. El ancho se ajusta en móvil |

**Resultado: PASA.** No hay violaciones que justificar.

**Re-check post-diseño (Fase 1): PASA.** La decisión de enlaces (research **R5.1**) quedó confirmada:
sandbox `allow-popups allow-popups-to-escape-sandbox`, sin ningún otro flag.

## Project Structure

### Documentation (this feature)

```text
specs/035-correo-html-seguro/
├── spec.md
├── plan.md                 # este archivo
├── research.md             # R1–R12
├── data-model.md           # MensajeCorreo, enum, contrato del comando, migración
├── quickstart.md           # validación automática y en navegador real
├── contracts/
│   ├── limpieza-html.md    # limpiarHtmlEntrante, prepararHtmlParaVista, DatosCorreoEntrante, catálogo
│   ├── rutas-http.md       # 5 rutas, token, middleware
│   └── proxy-imagenes.md   # descargarImagenSegura, límites, catálogo SSRF
├── checklists/requirements.md
└── tasks.md                # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                        # + MensajeCorreo, EstadoHtmlCorreo, relaciones inversas
└── migrations/20261117000000_correo_html_seguro/         # nueva, aditiva

src/integraciones/email/
├── mensaje/
│   ├── html/
│   │   ├── politica.ts                                  # NUEVO — lista blanca, VERSION_POLITICA, límites
│   │   ├── limpiar-html.ts                              # NUEVO — limpiarHtmlEntrante, prepararHtmlParaVista
│   │   ├── profundidad.ts                               # NUEVO — pre-chequeo con el tokenizer de htmlparser2
│   │   └── limpiar-html.test.ts                         # NUEVO — catálogo de 14 casos
│   ├── cabeceras.ts                                     # NUEVO — mailparser → DireccionCorreo[], topes
│   ├── normalizar.ts                                    # MOD — limpia el HTML, arma payload.correo
│   ├── normalizar.test.ts                               # MOD — reemplaza el test de la línea 51
│   ├── adjuntos.ts                                      # MOD — clasificación en línea/cid, tope propio
│   └── adjuntos.test.ts                                 # MOD
├── vista/
│   ├── schema.ts                                        # NUEVO — Zod de DireccionCorreo, AdjuntoCorreo
│   ├── token.ts (+ .test.ts)                            # NUEVO — firmar/verificar HMAC
│   ├── documento.ts (+ .test.ts)                        # NUEVO — documento base y cabeceras de seguridad
│   ├── direcciones-bloqueadas.ts (+ .test.ts)           # NUEVO — net.BlockList
│   ├── proxy-imagen.ts (+ .test.ts)                     # NUEVO — descargarImagenSegura
│   └── queries.ts                                       # NUEVO — lecturas acotadas por instanciaId
└── components/
    ├── hilo-correo.tsx                                  # MOD — usa los componentes de abajo en TarjetaCorreo
    ├── cabeceras-correo.tsx                             # NUEVO — De/Para/CC/fecha/asunto, "y N más"
    ├── cuerpo-correo.tsx                                # NUEVO — selector, iframe, aviso de imágenes, estados
    ├── lectura-ampliada-correo.tsx                      # NUEVO — Dialog con el mismo iframe
    └── adjuntos-correo.tsx                              # NUEVO — tarjetas con descarga

src/app/api/
├── correo/mensajes/[mensajeId]/route.ts                 # NUEVO — con sesión: metadatos + URLs firmadas
├── correo/mensajes/[mensajeId]/adjuntos/[mediaArchivoId]/route.ts   # NUEVO — descarga forzada
└── correo-aislado/{vista,cid,imagen}/route.ts           # NUEVO — con token

src/eventos/contratos/procesar-entrante.comando.ts       # MOD — correo?: DatosCorreoEntrante
src/conversaciones/types.ts                              # MOD — MensajeEntranteNormalizado.correo?
src/conversaciones/actions.ts                            # MOD — create anidado de MensajeCorreo (solo si viene correo)
src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts   # MOD — upsert de cabeceras de salida (best effort)
src/middleware.ts                                        # MOD — "/api/correo-aislado" en RUTAS_PUBLICAS
src/worker/grafo-importaciones.test.ts                   # sin cambios; debe seguir en verde con sanitize-html

tests/e2e/conversaciones/correo-html-seguro.spec.ts      # NUEVO

CLAUDE.md §9, specs/034-canal-correo-electronico/research.md R10, docs/ del canal   # MOD — nueva regla (FR-031)
.env.example                                             # MOD — CORREO_VISTA_SECRETO
```

**Structure Decision**: la feature extiende el módulo de canal de correo de 034
(`src/integraciones/email/`). Separa lo que corre en el worker (`mensaje/html/`, sin imports de Next) de lo
que corre solo en el servidor Next (`vista/`). La separación sigue la regla que vigila
`grafo-importaciones.test.ts`. La UI se monta sobre `hilo-correo.tsx`, de `fix/vista-correo-inbox`, sin
tocar `burbuja-mensaje.tsx` ni los grupos de mensajes de los demás canales.

## Fases de implementación (orden sugerido para /speckit-tasks)

1. **Base, que bloquea todo lo demás**: dependencia, migración, `politica.ts`, `limpiar-html.ts` con su
   catálogo, `token.ts` y `documento.ts`.
2. **US1 (P1)**:
   - `normalizar.ts` y el contrato del comando;
   - el `create` anidado;
   - la ruta con sesión;
   - la ruta `vista`;
   - el middleware;
   - `cuerpo-correo.tsx` (selector, iframe y estados);
   - el e2e del correo malicioso.

   Con esto ya hay un MVP seguro.
3. **US2 (P2)**: `cabeceras.ts`, cabeceras entrantes en el payload, upsert de salida y
   `cabeceras-correo.tsx`.
4. **US3 (P3)**: clasificación cid en `adjuntos.ts`, ruta `cid`, `direcciones-bloqueadas.ts`,
   `proxy-imagen.ts` con su catálogo SSRF, ruta `imagen` y el aviso con su acción.
5. **US4 (P4)**: `lectura-ampliada-correo.tsx`, `adjuntos-correo.tsx` y la ruta de descarga forzada.
6. **Cierre**:
   - FR-031 (CLAUDE.md §9, R10, docs y `normalizar.test.ts`);
   - `.env.example`;
   - verificación en navegador real según quickstart §3;
   - regresión de los demás canales.

## Riesgos de seguridad residuales

| Riesgo | Mitigación actual | Pendiente |
|---|---|---|
| La limpieza es síncrona y no se puede interrumpir a mitad de trabajo | Entrada ≤ 1 MB (parseo lineal), pre-chequeo de profundidad y tiempo medido | Mover a `worker_thread` con corte duro si aparecen correos patológicos |
| Mismo origen registrable que Karia | El sandbox sin `allow-same-origin` da un origen opaco, y la CSP con `sandbox` se aplica aunque la URL se abra sola | Mover la vista a un dominio aparte. El token ya está preparado para eso |
| Enlaces que abren pestañas (R5.1, opción A) | Solo con clic del agente, `noopener noreferrer`, sin scripts | — |
| Suplantación visual dentro del recuadro (un correo que "parece" Karia) | Sin `<style>` ni `position`, hoja clara con borde y cabeceras de Karia fuera del recuadro | Posible etiqueta "Contenido externo" sobre la hoja |
| Abuso del proxy (muchas peticiones) | Solo URLs del propio correo (≤ 50), token de 15 min y topes por petición | Límite de frecuencia por sesión si se observa abuso |
| Adjuntos maliciosos | Siempre se descargan con `application/octet-stream` y `nosniff`; nunca se abren en Karia | No hay antivirus (fuera de alcance, ver spec) |
| Bug futuro en `sanitize-html` | Segunda limpieza al servir, más el sandbox y la CSP como capas independientes | Mantener la dependencia al día (Dependabot) |

## Complexity Tracking

Sin violaciones de la constitución. No aplica.
