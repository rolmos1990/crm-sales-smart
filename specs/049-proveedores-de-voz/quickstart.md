# Quickstart: validar Proveedores de Voz y transcripción (049)

Guía de validación end-to-end. Detalles de modelo en [data-model.md](./data-model.md), de
adaptador en [contracts/proveedor-voz.md](./contracts/proveedor-voz.md), y el invariante de
alcance en [contracts/alcance-transcripcion.md](./contracts/alcance-transcripcion.md).

## Prerequisitos

- PostgreSQL y RabbitMQ arriba; `.env` con `DATABASE_URL`, `RABBITMQ_URL`, `TOKENS_CIFRADO_KEY`
  y la configuración de storage (`STORAGE_PROVIDER` y sus credenciales).
- Una cuenta de ElevenLabs con saldo y una API key.
- Una cuenta de prueba de WhatsApp Lite o Instagram conectada, para enviar notas de voz reales.

```bash
npm install
npm run db:migrate
npm run dev:full      # app Next.js + worker
```

> La transcripción corre en el **worker**. Con `npm run dev` solo, los audios se guardan pero no
> se transcriben.

## 1. Tests automáticos

```bash
npm run test:unit
```

Verde obligatorio. Los que importan de esta feature:

| Archivo | Qué fija |
|---|---|
| `src/voz/proveedores/elevenlabs.test.ts` | Parámetros enviados: `model_id`, header `xi-api-key`, multipart con `file`. Mockea `fetch`. |
| `src/voz/transcribir.alcance.test.ts` | **El invariante del contrato**: `video/mp4` + mensaje `VIDEO` ⇒ cero llamadas; `video/mp4` + mensaje `AUDIO` ⇒ se transcribe. |
| `src/voz/transcribir.test.ts` | `LISTO` vs `INAUDIBLE`: texto vacío, cero palabras, confianza < 0.5. Y que `INAUDIBLE` **no** reintenta. |
| `src/voz/cola.test.ts` | Backoff y lease, con `prisma.$executeRaw` mockeado. |
| `src/voz/proveedores/inicializar.test.ts` | `disponibles.ts` sincronizado con el registro. |
| `src/ai/contexto/constructor.test.ts` | Audio con transcripción entra al prompt; sin ella, entra como marcador y no como mensaje vacío. |

```bash
npm run test:e2e:configuracion   # alta/edición/toggle del proveedor
```

## 2. Configurar un proveedor

1. Abrir `http://localhost:3000/configuracion` → pestaña **Voz**.
2. **Agregar proveedor**: alias `elevenlabs-principal`, servicio ElevenLabs, modelo
   `scribe_v3`, API key, costo por hora `0.20`.
3. **Probar credenciales** → debe confirmar.
4. Encender **Transcripción automática**.

**Verificar que la credencial no sale al cliente** (FR-002): con DevTools → Network, recargar y
buscar `apiKey` en las respuestas. No debe aparecer, ni cifrada ni en claro.

**Verificar FR-003**: editar el proveedor, cambiar solo el alias, guardar sin tocar la API key,
y comprobar que sigue funcionando.

## 3. El camino feliz

Enviar una nota de voz desde el teléfono a la cuenta conectada.

Esperado en el inbox, en segundos:

- El reproductor de audio de siempre.
- Debajo, **Ver transcripción**. Al pulsarlo, el texto de lo que se dijo.

```sql
SELECT "transcripcionEstado", "transcripcionIdioma", "transcripcionSegundos",
       left(transcripcion, 60) AS texto
FROM "MediaArchivo"
WHERE modulo = 'conversaciones'
ORDER BY "creadoEn" DESC LIMIT 1;
```

Debe dar `LISTO`, el idioma detectado, la duración real y el texto.

## 4. El invariante que importa (SC-002)

**Enviar un video** por el mismo canal. Luego:

```sql
-- Debe dar 0. Siempre.
SELECT COUNT(*) FROM "MediaArchivo" ma
WHERE ma."transcripcionEstado" <> 'NO_APLICA'
  AND NOT EXISTS (
    SELECT 1 FROM "MensajeConversacion" m
    WHERE m."mediaArchivoId" = ma.id AND m.tipo IN ('AUDIO','NOTA_VOZ')
  );
```

Y que no se haya cobrado nada por él:

```sql
SELECT COUNT(*) FROM "UsoVoz" uv
JOIN "MediaArchivo" ma ON ma.id = uv."entidadId"
WHERE ma."mimeOriginal" LIKE 'video/%'
  AND NOT EXISTS (SELECT 1 FROM "MensajeConversacion" m
                  WHERE m."mediaArchivoId" = ma.id AND m.tipo IN ('AUDIO','NOTA_VOZ'));
-- Debe dar 0.
```

> En Instagram la nota de voz y el video llegan **ambos** como `video/mp4`. Esta comprobación es
> la razón de ser del contrato de alcance: es el único modo de notar la diferencia, porque el
> proveedor transcribiría el video sin devolver error.

## 5. Apagado y degradación

| Escenario | Cómo provocarlo | Esperado |
|---|---|---|
| Toggle apagado (FR-009, SC-004) | Apagar el interruptor y enviar una nota de voz | Se guarda y reproduce. `transcripcionEstado = NO_APLICA`. **Cero filas nuevas en `UsoVoz`.** |
| Proveedor caído (FR-028, SC-005) | Poner una API key inválida, enviar nota de voz | El mensaje llega y se muestra. La IA responde igual. La fila queda `PENDIENTE` y luego reintenta. Ningún error técnico visible al agente. |
| Audio inaudible (FR-017) | Grabar 5 s de silencio o música | Estado `INAUDIBLE`, texto `"Inaudible"`, y `transcripcionIntentos` **no** crece con el tiempo. |
| Duplicado (FR-016, SC-007) | Reenviar el mismo archivo de audio | Un solo `MediaArchivo`, una sola fila en `UsoVoz`. |
| Transcripción tardía (FR-025) | Dejar la conversación abierta mientras una pendiente termina | La burbuja se actualiza sola, sin recargar. |
| Aislamiento (FR-031) | Con sesión de otra instancia, pedir la conversación | 404 / sin acceso. Ni texto ni credencial. |

## 6. La IA usa el texto (P2)

Con un agente de IA habilitado, enviar una nota de voz con una pregunta concreta
("¿cuánto cuesta el combo familiar?").

- La respuesta del agente debe referirse a **lo preguntado**, no a un saludo genérico.
- Con un Workflow con nodo Menú activo, responder el menú **hablando** debe avanzar la ejecución.

## 7. Backfill del histórico (opcional)

Fuera del flujo normal a propósito (FR-010): encender el toggle no transcribe lo viejo.

```bash
npx tsx scripts/049-backfill-transcripciones.ts --instancia <id> --dry-run
```

Informa cuántos audios, cuántos minutos y cuánto costaría. Referencia medida en producción:
733 audios ≈ 2,6 h ≈ **0,52 USD**, con los 203 videos excluidos. Revisar ese conteo **antes** de
correrlo sin `--dry-run`.

## 8. Antes de dar por cerrado

```bash
npm run build        # exit 0
npm run test:unit    # verde
```

- [ ] `UsoVoz` tiene una fila por cada transcripción, con segundos y costo.
- [ ] La consulta del invariante del paso 4 da 0.
- [ ] Con el toggle apagado, `UsoVoz` no crece.
- [ ] Ningún log contiene la API key ni texto de conversaciones.
