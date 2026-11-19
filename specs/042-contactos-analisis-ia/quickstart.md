# Quickstart: validar el Análisis inteligente de Contactos (042)

Guía para comprobar de punta a punta que la feature funciona. El detalle de
los datos está en [data-model.md](./data-model.md) y los contratos en
[contracts/](./contracts/).

## Prerrequisitos

- Node 20+, PostgreSQL y RabbitMQ locales, y `.env` configurado como para
  `npm run dev:full`.
- Migraciones aplicadas: `npm run db:migrate`.
- Una cuenta de prueba con contactos, pedidos en etapas que cuentan y no
  cuentan como venta, cotizaciones activas y conversaciones
  (`npm run db:seed:test`).
- Para los escenarios con IA: en Configuración → IA, un proveedor activo
  (DeepSeek u OpenAI) con el objetivo **"Análisis de contactos"** asignado.

Variables de entorno nuevas, todas opcionales y con estos valores por defecto:

| Variable | Default | Uso |
|---|---|---|
| `ANALISIS_CONTACTOS_CONCURRENCIA` | `3` | Lotes simultáneos por worker |
| `ANALISIS_CONTACTOS_CUPOS` | `20,50,30` | % de la capacidad para P0, P1 y P2 |
| `ANALISIS_CONTACTOS_PRESUPUESTO_GLOBAL_USD` | sin límite | Presupuesto diario de Karia |
| `ANALISIS_CONTACTOS_HISTORICO_PAUSADO` | `false` | Pausa global del histórico (P2). **En producción, `true` hasta completar la Historia 4** (planificador justo) |
| `ANALISIS_CONTACTOS_INTERVALO_MS` | `2000` | Ciclo del motor |
| `ANALISIS_CONTACTOS_RECONCILIACION_MIN` | `15` | Barrido de eventos perdidos |

## 1. Clasificación inicial

```bash
npm run db:backfill:analisis-contactos   # scripts/042-encolar-clasificacion-inicial.ts (idempotente)
npm run dev:full                         # app + worker
```

**Esperado**:
- El log del worker muestra `[worker:analisis]` con lotes por cuenta,
  alternando entre cuentas.
- En unos minutos, todo contacto tiene evaluación. Los que no tienen
  conversación quedan con origen REGLA.
- Si se corre el script dos veces, no se duplica nada.

## 2. Perfil por reglas, sin IA (Historia 1)

1. En una cuenta **sin** IA habilitada, crea un segundo pedido en una etapa
   "Cuenta como Venta" para un contacto que ya tenía uno.
2. Espera la ventana de agrupación (5 min, o pon
   `ventanaAgrupacionSeg = 0` en la configuración de la cuenta).

**Esperado**: el panel lateral muestra "Cliente recurrente", un puntaje base
mayor, el motivo "2 compras confirmadas" y el aviso "Análisis con IA no
habilitado". La columna Puntaje de la tabla se actualiza.

## 3. Análisis con IA y sugerencias (Historia 2)

1. Simula un mensaje que pida precio y fecha:
   `npm run script:simular-wa` con "¿cuánto cuesta y me lo entregan el viernes?".
2. Abre el contacto y pulsa **Analizar con IA**.

**Esperado**:
- En menos de 60 s aparece intención Alta, urgencia, la señal "Consultó
  precio y fecha de entrega" sin citas textuales, la acción sugerida y la
  fecha.
- Con la cuenta en "Solo sugerir", aparece "Interés sugerido: Alto" con
  Aceptar y Descartar, y el interés **no** cambia.
- Al pulsar Aceptar, el interés pasa a Alto con origen manual y aparece en el
  historial.
- Si el contacto escribe "no me escriban más", aparece la sugerencia de "No
  contactar", y la preferencia no cambia hasta que una persona la confirme.

## 4. Atención justa y prioridad (Historia 4), con el simulador

```bash
npx tsx scripts/042-simular-carga-analisis.ts --cuentas 1000 --contactos 50 --grandes 3:10000 \
  --latencia-ms 800 --error-pct 5 --workers 2
```

**Esperado** en el informe del script:
- Todas las cuentas reciben su primer turno antes de que cualquiera reciba el
  segundo (SC-007).
- Una cuenta chica termina en su primer turno (SC-008).
- 0 contactos tomados por dos workers a la vez.
- Al matar un worker a mitad del proceso (`--matar-worker-en 30s`), el trabajo
  se recupera sin pérdidas (SC-012).

## 5. Auditoría (Historia 5)

```sql
-- Atenciones de hoy por cuenta
SELECT "instanciaId", count(*), sum("contactosExitosos"), sum("tokensEntrada"+"tokensSalida"), sum("costoEstimado")
FROM "EjecucionAnalisisContactos" WHERE "creadoEn" >= date_trunc('day', now()) GROUP BY 1;

-- Cuentas que más tiempo llevan sin ser atendidas
SELECT "instanciaId", "ultimaAtencionEn" FROM "ConfiguracionAnalisisContactos"
WHERE "habilitado" ORDER BY "ultimaAtencionEn" NULLS FIRST LIMIT 20;
```

**Esperado**:
- Un error forzado del proveedor (`--error-pct 100` en el simulador, o una
  clave inválida) deja atenciones `FALLIDA` con `errorCodigo` y sin claves en
  `errorMensaje`.
- Tras 5 intentos, los contactos quedan `FALLIDO`. "Reintentar fallidos" los
  devuelve a pendiente.

## 6. Avance y configuración (Historias 3 y 6)

En Configuración → IA → **Análisis de contactos**:

- El avance de la clasificación inicial usa como total solo los contactos con
  conversación de los últimos 12 meses.
- Pausar el histórico detiene P2 sin frenar los mensajes nuevos.
- Elegir la plantilla "Servicios / citas", agregar una señal, publicar y
  reevaluar: las evaluaciones nuevas muestran la versión publicada.
- Un usuario con rol Agente Ventas no ve esta sección y el servidor rechaza
  sus acciones.

## 7. Pruebas automáticas

```bash
npm run test:unit            # planificador, reglas, puntaje, salida IA, privacidad, ejecutor
npm run test:e2e:contactos   # 041 sin regresiones + panel, columna Puntaje y sugerencias
npm run test:e2e:configuracion
npm run build
```

**Esperado**: todo en verde, incluidas las pruebas existentes de 041 y 038 sin
modificar (SC-015).
