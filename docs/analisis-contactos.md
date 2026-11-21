# Análisis inteligente de Contactos (042)

Motor que mantiene un **perfil comercial por contacto**: relación comercial, puntaje 0–100, intención de compra, señales, objeciones y acción sugerida.

- Para **todas** las cuentas corre por reglas, sin costo.
- La IA entra solo para interpretar conversaciones nuevas, en lotes, con el proveedor y el criterio de cada cuenta.

Spec, plan y decisiones: `specs/042-contactos-analisis-ia/` (research D1–D17).

---

## 1. Arquitectura

```
 Eventos ──► marcarPendiente (cola.ts) ◄── interaccion.ts (en línea)
 (pedido, cotización, oportunidad,          ◄── barrido de reconciliación (15 min)
  contacto, conversación clasificada)       ◄── "Analizar con IA" / selección / segmento
        │
        ▼
 ContactoAnalisisCola  ─ 1 fila permanente por contacto, versión monótona
        │
        ▼
 Ciclo del worker (motor/ciclo.ts, cada 2 s)
   1. recuperarTrabajoAbandonado (leases vencidos)
   2. repartirEspacios: cupos P0/P1/P2 con préstamo (planificador.ts)
   3. tomarTurnoCuenta: stride scheduling + SKIP LOCKED (cola.ts)
   4. reclamarLote ≤ tamanoLote contactos de UNA cuenta
        │
        ▼
 procesarLote (motor/ejecutor.ts)
   reglas (todos) ─► embudo ─► IA (solo con conversación nueva y disponibilidad)
   validación Zod + privacidad ─► escritura con guarda de versión ─► ContactoAnalizado
```

| Pieza | Archivo |
|---|---|
| Cola, reclamo, backoff, turnos | `src/crm/contactos/analisis/cola.ts` |
| Reglas y puntaje (puros) | `reglas.ts`, `puntaje.ts` |
| Datos de un lote en bloque | `datos-lote.ts` |
| Planificador justo (puro) | `motor/planificador.ts` |
| Ciclo del worker | `motor/ciclo.ts` (arrancado en `src/worker/disparadores.ts`) |
| Ejecución de un lote | `motor/ejecutor.ts`, `motor/decisiones.ts` |
| Disponibilidad y presupuestos | `motor/presupuesto.ts`, `motor/disponibilidad.ts` |
| Auditoría, recuperación y retención | `motor/auditoria.ts`, `motor/recuperacion.ts`, `motor/retencion.ts` |
| Barrido de eventos perdidos | `motor/reconciliacion.ts` |
| Contrato con la IA | `src/ai/analisis-contactos/` (`prompt.ts`, `contexto.ts`, `salida.ts`, `evaluar-lote.ts`) |
| Criterio por cuenta | `criterio/` (plantillas en código, versiones en la base) |
| Panel, columna Puntaje y selección | `components/`, `src/crm/contactos/components/tabla-contactos.tsx` |
| Configuración → IA | `src/configuracion/components/analisis-contactos/` |

**Por qué PostgreSQL y no RabbitMQ para planificar**:

- RabbitMQ no permite elegir "la cuenta que más tiempo lleva esperando" sin una cola por cuenta.
- RabbitMQ no deduplica por contacto.
- RabbitMQ no tiene backoff.
- Es el mismo patrón que `DisparadorJob`: lease más `FOR UPDATE SKIP LOCKED`.

RabbitMQ se sigue usando para los eventos de dominio que entran y para `ContactoAnalizado`, que sale.

---

## 2. Reglas que no se negocian

- **"Cliente" no se guarda.** `relacionComercial` en la evaluación es una foto para el panel, no un filtro. Los filtros siguen saliendo de `segmentacion/condiciones.ts` (CLAUDE.md, reglas 10 y 12).
- **La IA no afirma hechos.** La salida no tiene campos para compras, pagos ni pedidos. RESPONDER y NO_CONTACTAR los deciden solo las reglas (FR-021).
- **Interés**: lo escribe solo `clasificacion.ts`.
  - Modo `SOLO_SUGERIR` (por defecto): la IA deja una sugerencia que una persona acepta.
  - Modo `APLICAR_AUTOMATICO`: la IA escribe con origen IA, respetando el interés fijado a mano.
- **"No contactar" nunca lo escribe la IA**: solo lo sugiere.
- **Privacidad (FR-017a).** El servidor **rechaza** señales u objeciones con:
  - teléfonos, emails o URLs;
  - números de 7 o más dígitos;
  - direcciones (palabra de vía seguida de un número);
  - citas copiadas de la conversación — **tramos de 40 caracteres o más** (052).

  Salud y pago no se detectan por patrón: los prohíbe el prompt y se revisan por muestreo.

  **El umbral de cita sale de una medición y bajarlo exige repetirla.** Estuvo en 25 y rechazaba
  uno de cada diecisiete análisis por frases como *"el precio de las esferas"*: 25 caracteres de
  español corriente los alcanza cualquier resumen fiel. Sobre 1284 textos libres de 400
  evaluaciones **ya aceptadas**, el solape máximo era 24 (p50 9 · p90 15 · p95 19 · p99 22) — y
  que el máximo fuera 24 con el umbral en 25 **no probaba holgura, probaba truncamiento**: todo lo
  que hubiera superado 24 fue rechazado y nunca llegó a medirse. Los rechazos reproducidos contra
  la API tienen solape 26–29. Sin hueco entre ambos grupos, el corte partía por el medio la
  distribución natural de la paráfrasis. Con 40 las 1284 siguen aceptándose y una cita real
  —48 caracteres en el test de la batería— se sigue rechazando.

  **El rechazo dice cuál control se disparó** (052): `PRIVACIDAD_EMAIL`, `PRIVACIDAD_URL`,
  `PRIVACIDAD_SECUENCIA_NUMERICA`, `PRIVACIDAD_DIRECCION`, `PRIVACIDAD_CITA`, más
  `REF_DUPLICADA` y `FORMATO_INVALIDO`, en `EjecucionAnalisisContactosItem.errorCodigo`. Antes los
  tres motivos compartían `RESPUESTA_INVALIDA` y averiguar cuál había sido exigió reconstruir el
  pipeline y volver a llamar a la IA contacto por contacto. Separar `PRIVACIDAD_CITA` del resto es
  lo que permite saber **en una consulta** si una subida de rechazos es calibración del filtro o
  información personal entrando de verdad.

  Lo que se guarda es siempre un código de un conjunto cerrado: **nunca el texto generado ni el
  tramo que coincidió**, que son palabras del cliente. Guardar el tramo sería lo más útil para
  diagnosticar y es exactamente lo prohibido.
- **Prompt en 3 capas**:
  1. Reglas fijas de Karia.
  2. `<criterio_negocio>`.
  3. `<datos_lote>`.

  Lo que escribió el negocio o el contacto es información, nunca instrucciones. Cambiar el prompt implica subir `PROMPT_SISTEMA_VERSION`.
- **Referencias del lote** (`c1…cN`): el modelo nunca ve ids internos, así que no puede tocar contactos de otra cuenta.
- **Compatibilidad con el perfil 012.** Si el análisis con IA está activo y disponible:
  - `CONVERSACION_CLASIFICADA` marca P0 inmediato.
  - El motor escribe `datosInterpretados`, con la misma lista `INTENCIONES_COMERCIALES`.

  Si no lo está, la extracción por evento sigue como siempre. Nunca se apaga un camino sin el otro: `marcarMotorIAConectado`.
- **Bucle de eventos (R3).** Ningún suscriptor que marque contactos escucha `CONTACTO_ANALIZADO` ni `CONTACTO_INTERES_ACTUALIZADO`.

---

## 3. Estados

**Cola** (`ContactoAnalisisCola.estado`):

```
AL_DIA ─marcar─► PENDIENTE ─reclamar─► EN_PROCESO ─completar (misma versión)─► AL_DIA
                     ▲                      │ datos nuevos durante el análisis → PENDIENTE
                     │                      │ error / lease vencido → PENDIENTE (backoff)
                     └──"Reintentar"── FALLIDO ◄── 5 intentos
```

- **Prioridades**:
  - **P0**: "Analizar con IA" o entrada en señal de compra (ficha 031). Sin ventana de agrupación.
  - **P1**: cambios recientes. Ventana de 5 min y espera máxima de 30 min.
  - **P2**: clasificación inicial y reevaluaciones.
- **Backoff**: `30 s × 2^intentos`, con tope de 30 min y jitter de 0,8 a 1,2.

**Atención** (`EjecucionAnalisisContactos.estado`): `EN_CURSO` termina en `COMPLETADA`, `PARCIAL`, `FALLIDA` o `ABANDONADA` (esta última si el lease venció). Cada intento es una fila. La finalización lógica de cada contacto se cuenta en la cola y no en las atenciones, para no contar dos veces.

---

## 4. Configuración

**Por cuenta** (Configuración → IA → Análisis de contactos, permiso `ia`):

| Campo | Default | Efecto |
|---|---|---|
| Analizar contactos con IA | encendido | Apagado: solo reglas, y el perfil 012 vuelve a la extracción por evento |
| Pausar la clasificación inicial | apagado | Excluye P2 |
| Nivel de interés sugerido | Solo sugerir | O "Aplicar automáticamente". Cambiarlo no reescribe intereses existentes |
| Antigüedad para la clasificación inicial | 12 meses | Fuera del plazo, solo reglas |
| Presupuesto diario (US$ o tokens) | sin presupuesto propio | Solo aplican los límites del proveedor y el global |
| Contactos por lote / lotes simultáneos | 20 / 1 | |
| Agrupar cambios / espera máxima | 5 min / 30 min | |
| `peso` | 1 | **Solo el equipo de Karia**, directo en la base: más peso, más turnos |

**Criterio por cuenta**: plantillas General, Comercio minorista, Servicios / citas y B2B. Se publica por versiones; publicar puede reevaluar los contactos como P2.

**Plataforma** (variables de entorno del worker):

| Variable | Default | |
|---|---|---|
| `ANALISIS_CONTACTOS_CONCURRENCIA` | 3 | Lotes simultáneos por worker |
| `ANALISIS_CONTACTOS_CUPOS` | `20,50,30` | % P0/P1/P2; tienen que sumar 100 |
| `ANALISIS_CONTACTOS_PRESUPUESTO_GLOBAL_USD` | sin límite | Diario, en UTC |
| `ANALISIS_CONTACTOS_HISTORICO_PAUSADO` | false | **En producción, `true` hasta validar el planificador con el simulador** |
| `ANALISIS_CONTACTOS_INTERVALO_MS` | 2000 | |
| `ANALISIS_CONTACTOS_RECONCILIACION_MIN` | 15 | |

**Disponibilidad de la IA** (`motor/presupuesto.ts`): se revisa antes de cada lote, en este orden.

1. Presupuesto global.
2. Presupuesto propio de la cuenta.
3. `ConfiguracionIA.limiteTokensDiarios`: desde el 80 % se pausa P2; al 100 %, todo.
4. `limitePorMinuto` y `limitePorDia` del proveedor.

Sin disponibilidad, el lote se resuelve por reglas.

---

## 5. Cambiar de proveedor o modelo

Configuración → IA → **Enrutamiento por objetivo** → "Análisis de contactos". Se asigna el proveedor (DeepSeek, OpenAI, Anthropic…) y su modelo en `modelosDisponibles`.

- No se toca nada del motor (SC-013).
- Si el proveedor asignado tiene el circuit breaker abierto, `seleccionarProveedor` usa el siguiente activo.
- Cada atención guarda el proveedor y el modelo que realmente usó.

---

## 6. Escalar

- **Más workers**: levantar otra réplica de `npm run worker`. `SKIP LOCKED` reparte cuentas y contactos sin coordinación (FR-031).
- **Más capacidad por worker**: `ANALISIS_CONTACTOS_CONCURRENCIA`. **No subirla sin revisar** los presupuestos y los límites de los proveedores (FR-045).
- **Validar antes de producción**:

  ```bash
  npx tsx scripts/042-simular-carga-analisis.ts --confirmar \
    --cuentas 1000 --contactos 50 --grandes 3:10000 --workers 2 --latencia-ms 800 --error-pct 5
  ```

  Solo contra una base de desarrollo. Usa cuentas sintéticas, un ejecutor de IA simulado y se limpia solo.

---

## 7. Consultas operativas (Historia 5)

```sql
-- ¿Cuántas veces atendimos a cada cuenta hoy, cuántos contactos, tokens y costo?
SELECT "instanciaId", COUNT(*) AS atenciones, SUM("contactosExitosos") AS contactos,
       SUM("tokensEntrada" + "tokensSalida") AS tokens, SUM("costoEstimado") AS costo
FROM "EjecucionAnalisisContactos"
WHERE "creadoEn" >= date_trunc('day', now())
GROUP BY 1 ORDER BY atenciones DESC;

-- ¿Qué proveedor y modelo usamos, y cuánto duró cada lote?
SELECT "proveedor", "modelo", COUNT(*), AVG("duracionMs")::int AS duracion_media_ms
FROM "EjecucionAnalisisContactos" WHERE "modo" = 'IA' AND "creadoEn" >= now() - interval '1 day'
GROUP BY 1, 2;

-- Intentos fallidos o abandonados, con su causa
SELECT "instanciaId", "loteId", "intento", "estado", "errorCodigo", "errorMensaje", "creadoEn"
FROM "EjecucionAnalisisContactos"
WHERE "estado" IN ('FALLIDA', 'ABANDONADA') AND "creadoEn" >= now() - interval '1 day'
ORDER BY "creadoEn" DESC;

-- ¿Cuántos contactos quedan pendientes por cuenta y prioridad?
SELECT "instanciaId", "prioridad", COUNT(*) FROM "ContactoAnalisisCola"
WHERE "estado" IN ('PENDIENTE', 'EN_PROCESO') GROUP BY 1, 2 ORDER BY 3 DESC;

-- Cuentas que más tiempo llevan sin ser atendidas
SELECT "instanciaId", "ultimaAtencionEn", "siguienteTurnoEn", "peso", "lotesEnCurso"
FROM "ConfiguracionAnalisisContactos" ORDER BY "ultimaAtencionEn" NULLS FIRST LIMIT 20;

-- Histórico (el detalle por contacto se purga a los 90 días; el agregado diario queda)
SELECT * FROM "ResumenDiarioAnalisisContactos" WHERE "instanciaId" = $1 ORDER BY "dia" DESC LIMIT 30;
```

Los registros **no** contienen claves, prompts ni texto de conversaciones (FR-041). `configAplicada` solo guarda parámetros y versiones, y `errorMensaje` se sanitiza.

---

## 8. Recuperar trabajo

- **Worker caído**: no hace falta hacer nada. En el ciclo siguiente de cualquier réplica:
  - las filas `EN_PROCESO` con lease vencido (3 min) vuelven a `PENDIENTE`;
  - las atenciones quedan `ABANDONADA`.
- **Contactos FALLIDO** (5 intentos): Configuración → IA → Análisis de contactos → "Reintentar". Por SQL:

  ```sql
  UPDATE "ContactoAnalisisCola" SET "estado"='PENDIENTE', "intentos"=0, "elegibleDesde"=now()
  WHERE "instanciaId" = $1 AND "estado"='FALLIDO';
  ```
- **Eventos perdidos**: el barrido de reconciliación marca:
  - contactos con actividad posterior a `datosHasta`;
  - contactos nuevos sin fila de cola;
  - evaluaciones vencidas.
- **Clasificación inicial de cuentas existentes**: `npm run db:backfill:analisis-contactos`. Es idempotente.

---

## 9. Deuda conocida

- `limiteTokensDiarios`, `limitePorMinuto` y `limitePorDia` **los respeta solo el análisis**. El agente conversacional todavía no los aplica (riesgo R7; cambiarlo alteraría su comportamiento, FR-055).
- El circuit breaker de proveedores vive en memoria de cada proceso. Con varios workers, cada uno aprende la falla por su cuenta (R8).
- `ConfiguracionAnalisisContactos.peso` no tiene pantalla: el día que existan planes comerciales, derivarlo del plan.
- Fusionar el perfil 012 con la evaluación queda para una spec aparte.
