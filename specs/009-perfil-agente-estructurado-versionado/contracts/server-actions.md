# Contratos: Server Actions — `src/configuracion/ia/agente-actions.ts`

Karia no expone API pública para esta feature — la superficie es de Server Actions consumidas por la UI de `/configuracion`. Todas requieren sesión (`requireSesion`) y permiso `"ia"` vía `verificarAcceso`, y todas están scoped a `sesion.instanciaId`, siguiendo el patrón ya usado por `guardarAgenteIA` actual.

## `guardarAgenteIA(usuarioId, datos)` — extendido

Sin cambio de firma. `datos` acepta ahora los campos nuevos de `AgenteIAConfigSchema` (todos opcionales). Comportamiento: actualiza **solo la fila `AgenteIAConfig` viva** (compat con cualquier llamador actual que no sepa de versionado) — no crea versión. Uso esperado tras esta spec: solo para los campos que no pasan por el flujo de borrador/publicación explícito (transición suave); la UI nueva usa `guardarBorradorAgenteIA` en su lugar.

- **Input**: `usuarioId: string`, `datos: unknown` (validado contra `AgenteIAConfigSchema` extendido)
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Errores**: datos inválidos (Zod) → `"Datos inválidos"`; usuario fuera de la instancia → `"Agente no encontrado en esta instancia"`; sin permiso → mensaje de `verificarAcceso`.

## `guardarBorradorAgenteIA(agenteIAConfigId, datos)` — nuevo

- **Input**: `agenteIAConfigId: string`, `datos: unknown` (validado contra `AgenteIAConfigSchema` extendido)
- **Output**: `{ exito: true; versionId: string } | { exito: false; error: string }`
- **Comportamiento**: upsert sobre la fila `AgenteIAConfigVersion` con `estado = BORRADOR` para ese agente (crea si no existe). No toca `AgenteIAConfig` (la publicada vigente).
- **Errores**: mismos que `guardarAgenteIA`, más conflicto de edición concurrente (Edge Case: `"La configuración fue modificada por otra persona, recargá antes de guardar"` si el borrador cambió desde que se cargó — comparación por `actualizadoEn`).

## `publicarVersionAgenteIA(agenteIAConfigId)` — nuevo

- **Input**: `agenteIAConfigId: string`
- **Output**: `{ exito: true; numero: number } | { exito: false; error: string; advertencias?: string[] }`
- **Comportamiento**: dentro de una transacción — (1) valida que no haya conflictos bloqueantes (frase en preferidas y prohibidas a la vez); (2) corre la detección de contradicciones de FR-007 sobre `sistemaPrompt` vs. reglas estructuradas → si hay hallazgos, se devuelven en `advertencias` pero **no bloquean** la publicación si el llamador confirma (`forzar: boolean` opcional en el input); (3) marca la fila `BORRADOR` como `PUBLICADA` con el siguiente `numero`; (4) copia su `contenido` a `AgenteIAConfig`.
- **Errores**: sin borrador pendiente → `"No hay cambios sin publicar"`; conflicto bloqueante → detalle del conflicto.

## `duplicarVersionAgenteIA(versionId)` — nuevo

- **Input**: `versionId: string` (cualquier versión del historial, publicada o borrador)
- **Output**: `{ exito: true; nuevoBorradorId: string } | { exito: false; error: string }`
- **Comportamiento**: crea una nueva fila `BORRADOR` con el `contenido` de la versión indicada. Si ya existe un borrador activo para el agente, lo reemplaza (con confirmación en la UI antes de llamar, ver `quickstart.md`).

## `restaurarVersionAgenteIA(versionId)` — nuevo

- **Input**: `versionId: string` (debe ser una versión `PUBLICADA` del historial)
- **Output**: `{ exito: true; numero: number } | { exito: false; error: string }`
- **Comportamiento**: crea una nueva fila `PUBLICADA` (nuevo `numero`) con el `contenido` de la versión restaurada, y actualiza `AgenteIAConfig` con ese contenido. No borra ni modifica la versión original que se restauró ni ninguna otra del historial.

## `listarVersionesAgenteIA(agenteIAConfigId)` — nuevo

- **Input**: `agenteIAConfigId: string`
- **Output**: `Array<{ id: string; numero: number | null; estado: "BORRADOR" | "PUBLICADA"; publicadaEn: Date | null; creadaPor: string | null; creadoEn: Date }>` (sin `contenido` completo — solo metadata para la lista; el contenido se pide aparte al abrir/comparar una versión puntual)
- **Comportamiento**: ordenado por `numero` descendente (más reciente primero), borrador (si existe) siempre primero.

## `cargarConfigAgenteIA(usuarioId)` — sin cambio de firma

Extiende el `select` de Prisma para incluir los campos nuevos de `AgenteIAConfig` (la versión publicada vigente). No devuelve el historial — eso es responsabilidad de `listarVersionesAgenteIA`.
