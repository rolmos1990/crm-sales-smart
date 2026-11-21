# Quickstart: verificar el arreglo del nombre de archivo

**Feature**: `051-fix-nombre-archivo-voz` | **Date**: 2026-11-21

Los tests cubren la composición del nombre y el invariante
([contracts/nombre-archivo.md](./contracts/nombre-archivo.md)). Esto cubre el flujo real contra
los proveedores.

## Prerequisitos

- Base de datos migrada. **Este hotfix no agrega migración**: si `prisma migrate` propone algo,
  hay un cambio de esquema que no debería estar.
- **El worker corriendo** — la transcripción solo corre ahí.
- Una cuenta con el interruptor de transcripción encendido.
- Credenciales válidas de **Groq** y de **ElevenLabs**: hacen falta las dos, una para probar el
  arreglo y otra para probar que no se rompió nada.

## Comandos

```bash
npm run dev:worker                       # el worker
npm run test:unit -- src/voz             # tests del módulo de voz
npm run build
```

---

## Escenario 1 — El caso reportado, de punta a punta (US1, FR-001)

1. Dejá **Groq** como único proveedor activo.
2. Mandá una nota de voz por Instagram.

**Esperado**: el mensaje aparece transcrito en el inbox. Ningún fallo nuevo en el registro de uso.

**Antes del arreglo** esto fallaba en ~97 ms con el código de formato no soportado y el audio
quedaba muerto al primer intento.

3. Repetí con una nota de voz de **WhatsApp** (`audio/ogg; codecs=opus`).

**Esperado**: también se transcribe. Esos 6 audios en producción estaban igual de rotos; solo
nadie los había pasado por Groq todavía.

## Escenario 2 — Lo mismo con OpenAI (US1, FR-004)

Cambiá el proveedor activo a **OpenAI** y repetí el escenario 1.

**Esperado**: se transcribe igual. OpenAI valida por extensión como Groq, así que si este
escenario falla, el arreglo quedó en un solo adaptador en vez de en el punto compartido.

## Escenario 3 — No-regresión en ElevenLabs (US1 escenario 3, FR-005)

**El más importante del hotfix.** ElevenLabs ya funcionaba y ahora recibe un nombre distinto
(`audio-123.mp4` donde antes recibía `audio-123`).

1. Dejá **ElevenLabs** como único proveedor activo.
2. Mandá tres notas de voz: una de Instagram, una de WhatsApp y una larga (más de 30 s).

**Esperado**: las tres se transcriben, con la misma calidad de texto, el mismo idioma detectado y
los mismos segundos registrados que antes del cambio. Compará contra una transcripción previa del
mismo audio si tenés una.

**Si algo cambia acá, el arreglo está mal ubicado** y hay que moverlo al transporte compartido de
Groq/OpenAI en vez de al punto común (ver Decisión 2 de [research.md](./research.md)).

## Escenario 4 — Un formato genuinamente inválido sigue fallando definitivo (FR-006)

Mandá como nota de voz un archivo que no sea audio reconocible.

**Esperado**: falla con el código de formato no soportado, **un solo intento**, y queda en error
definitivo. No se reintenta cinco veces.

**Lo que NO debe pasar**: que el arreglo haya vuelto reintentable ese fallo. Eso costaría cinco
llamadas pagas por cada audio inválido.

## Escenario 5 — La recuperación (US2)

1. Con el arreglo **ya desplegado** (si no, los audios vuelven a fallar igual), simulá:

```bash
npx tsx scripts/051-recuperar-formato-no-soportado.ts
```

**Esperado**: lista los audios que recuperaría —en producción, **1**— y dice explícitamente que
no escribió nada.

2. Verificá que **no** incluye los otros dos audios en error, que fallaron contra ElevenLabs por
otra causa y quedan fuera a propósito.

3. Aplicá:

```bash
npx tsx scripts/051-recuperar-formato-no-soportado.ts --aplicar
```

**Esperado**: los audios vuelven a la cola y, en la siguiente vuelta del worker, quedan
transcritos. El de Ramón debería decir algo muy parecido a *"Hola mire, ustedes saben si tienen
el Lunada disponible…"*, que es lo que Groq devolvió al reproducir el fallo.

4. Volvé a ejecutarlo.

**Esperado**: "nada que recuperar". Ningún audio se transcribe dos veces, nadie paga dos veces
(SC-005).

---

## Verificaciones que no se ven en el inbox

### El resto del flujo no se movió (FR-007)

- **Tope diario de minutos**: configurá un tope bajo y confirmá que sigue cortando.
- **Audio inaudible**: mandá un audio en silencio y confirmá que queda marcado como inaudible y
  **no** se reintenta.
- **Reintentos y backoff**: con una credencial inválida a propósito, confirmá que el audio se
  reintenta con espera creciente y termina en error tras cinco intentos — no al primero.

### El contador de intentos (Decisión 5)

Tras recuperar, el audio debe quedar con el contador de intentos en cero. Si conservara los
previos, un audio que ya los hubiera agotado volvería a error al primer tropiezo real.

Y al revés: un reintento **normal** —no recuperado por el script— debe seguir acumulando
intentos. Si el valor por defecto del nuevo parámetro quedó invertido, el tope de cinco deja de
existir para todos y nadie lo nota hasta que un proveedor caído genera llamadas sin fin.

### Aislamiento entre cuentas (FR-010)

Ejecutá la recuperación con `--instancia <id>` en una cuenta y confirmá que no tocó audios de
otra.
