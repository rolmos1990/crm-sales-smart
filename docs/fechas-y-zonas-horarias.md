# Fechas y zonas horarias en Karia

## La regla

> Karia almacena, transmite y procesa timestamps internos en **UTC**. La zona
> horaria IANA efectiva viaja como contexto mediante la cookie `karia_tz`, que
> el middleware promueve al header `x-time-zone`. Las fechas/horas locales de
> entrada se interpretan usando esa zona y se convierten a UTC cuando
> representan un instante. Los filtros basados en días/meses locales se
> convierten a rangos UTC. Las APIs retornan timestamps UTC y React hace la
> conversión final para presentación. Las fechas calendario puras no se
> convierten como timestamps.

Identificadores IANA siempre (`America/Panama`, `Europe/Madrid`). **Nunca**
offsets fijos como `UTC-5`: no contemplan el horario de verano, así que dan el
día equivocado la mitad del año en Santiago o Madrid.

---

## Dos zonas, no una

Es la distinción central y la fuente de casi todos los errores si se confunde.

| | `obtenerZonaNegocio(instanciaId)` | `obtenerPreferenciasFechaEfectivas(...)` |
|---|---|---|
| Módulo | `src/shared/fechas/negocio.ts` | `src/shared/fechas/presentacion.ts` |
| Origen | Solo `ConfiguracionEmpresa.zonaHoraria` | usuario → empresa → navegador → UTC |
| Para qué | Rangos de día, filtros, KPIs, cuotas, reglas | Formatear un instante en pantalla |
| Disponible en | Todo, incluido el worker | Solo contextos con request |

**El invariante a defender en revisión: si un valor termina en un `where` de
Prisma, salió de la zona de negocio.**

Por qué: si la zona del usuario decidiera los rangos, dos personas del mismo
tenant verían totales distintos para "ventas de hoy" sin poder reconciliarlos.
Un administrador en España mirando una empresa de Panamá debe seguir viendo el
día operativo de Panamá; lo único que cambia para él es con qué reloj se
renderizan las horas.

`Usuario.zonaHoraria` es nullable y **solo presentación**. La columna existe
pero todavía no hay UI para configurarla.

---

## Cómo viaja la zona del navegador

React controla el `fetch` de las Server Actions, así que desde el cliente **no
se les pueden agregar headers**. Y las Server Actions son ~95% del tráfico. Por
eso la cadena es:

```
TimeZoneProvider (cliente)
  └─ useEffect → cookie karia_tz = Intl...resolvedOptions().timeZone
       └─ middleware: valida IANA y la promueve a header x-time-zone
            └─ headers().get("x-time-zone") funciona igual en
               RSC · Server Action · Route Handler · SSE
```

La cookie viaja en todo, incluido `EventSource`, que no puede mandar headers
pero sí cookies same-origin.

El middleware hace `headers.delete("x-time-zone")` **antes** de setearlo:
`/api/webhooks/**` es público y lo matchea el middleware, así que sin eso
cualquiera podría inyectar el header a mano y provocar un `RangeError` en
`Intl`. El código de webhooks usa `obtenerZonaNegocio(instanciaId)`, nunca el
header.

No hace falta script inline bloqueante ni `suppressHydrationWarning`: en
cualquier página autenticada la zona de empresa siempre resuelve, así que la
capa navegador nunca decide nada ahí. El cliente jamás llama a
`resolvedOptions().timeZone` durante el render — la zona llega como prop desde
un Server Component.

---

## Las tres clases de valor

Definidas en `src/shared/fechas/tipos.ts`.

### `Instante` (`Date`)
Un momento real: creación de pedido, mensaje enviado, pago. Se almacena y
transmite en UTC. Es el caso por defecto y no necesita nada especial.

### `FechaHoraLocal` (`"YYYY-MM-DDTHH:mm"`)
Hora de pared que el usuario tipeó: programar un seguimiento, una agenda. Solo
existe en el borde de la UI. Se convierte con `aInstante(valor, zona)` antes de
persistir.

Usar **`<InputFechaHora>`** (`src/shared/fechas/components/`), nunca un
`<input type="datetime-local">` a mano.

### `FechaCalendario` (`"YYYY-MM-DD"`)
Un día, sin hora: cumpleaños, un vencimiento que funcionalmente es solo una
fecha. **No se convierte como timestamp.**

Usar **`<InputFecha>`** o `<SmartDatePicker>`, nunca `.toISOString().slice(0,10)`.

**Convención de almacenamiento**: las columnas de fecha-calendario siguen siendo
`DateTime` (no hay `@db.Date` en el schema) y guardan **la medianoche local de
la zona de negocio**. Se escriben solo vía `desdeFechaCalendario(ymd, zona)` y
se leen solo vía `aFechaCalendario(fecha, zona)`.

> **Por qué no se migró a `@db.Date`**: esas columnas contienen hoy dos
> convenciones mezcladas sin discriminador — filas con medianoche UTC exacta
> (de los `type="date"` y la importación) y filas con hora arbitraria (de
> `SmartDatePicker`). Las dos requieren reglas de conversión **opuestas**, así
> que ninguna regla única es correcta y cualquier heurística movería en
> silencio la fecha de entrega comprometida de algún cliente. Además Prisma
> mapea `@db.Date` a un `Date` en medianoche UTC, con lo cual el problema se
> relocaliza en vez de desaparecer. Primero se deja de generar datos sucios
> (ya hecho); el backfill queda como limpieza opcional posterior.

---

## Filtros y consultas

Siempre rangos semiabiertos `[desde, hasta)` sobre la columna cruda:

```ts
const hoy = rangoHoy(sesion.zonaNegocio);
where.fecha = { gte: hoy.desde, lt: hoy.hasta };
```

Helpers en `src/shared/fechas/rangos.ts`: `rangoHoy`, `rangoAyer`,
`rangoManana`, `rangoUltimosDias`, `rangoEstaSemana` (semana calendario, lunes a
domingo), `rangoEsteMes`, `rangoMesHastaAhora`, `rangoEntreFechas`,
`aFiltroPrisma`.

Los pares desde/hasta de la URL se parsean con
`parsearExtremosDeSearchParams(sp, zona, { prefijo })`
(`src/shared/fechas/searchparams.ts`). `hasta` es **inclusivo por día**: pedir
17→17 devuelve el 17 entero.

Reglas que no se negocian:

- **Nunca `lte` sobre un límite de día.** Un `endOfDay()` devuelve `.999` y
  pierde las filas escritas en `.9995` de una columna `timestamp(3)`.
- **Nunca `AT TIME ZONE` ni `DATE_TRUNC` sobre la columna**: impide usar el
  índice. Se comparan dos instantes UTC ya calculados.
- **Las funciones de query reciben `zonaHoraria: string` como parámetro
  explícito.** Nunca resuelven la zona por dentro, porque varias son alcanzables
  desde el worker, que no tiene request.

`rangoSemanaEnZona` (en `src/sales/preparacion/utils/rangos.ts`) significa "los
próximos 7 días incluyendo hoy", **no** la semana calendario. Es otro concepto
que `rangoEstaSemana`; el tablero de preparación depende de él.

### El selector de rango en la UI

La barra de filtros no arma su propio `<Calendar mode="range">`: usa
`<FiltroRangoFechas>` (`src/shared/fechas/components/filtro-rango-fechas.tsx`),
que emite el par `"YYYY-MM-DD"` que después lee
`parsearExtremosDeSearchParams`. Recibe `zonaNegocio` como prop —los atajos
("Hoy", "Próximos 7 días") tienen que resolver el día en la zona de negocio,
igual que el `where` al que alimentan— y la lógica pura vive aparte en
`src/shared/fechas/rango-ymd.ts` para poder testearla sin DOM.

Dos comportamientos de react-day-picker que el componente corrige y que
conviene no reintroducir:

- **`addToRange` con `min = 0` devuelve `{ from, to }` completo en el primer
  clic.** Cerrar el popover "cuando el rango está completo" lo cierra después
  de elegir el primer día, y elegir un rango de varios días se vuelve
  imposible sin reabrirlo.
- **Un segundo clic sobre el mismo día deselecciona todo**, así que un rango de
  un solo día (`de X a X`) no se puede confirmar. El componente maneja los dos
  clics él mismo (`cerrarRango`) en vez de delegar en `addToRange`.

---

## Presentación

```tsx
<FechaHora valor={pedido.creadoEn} modo="fechaHora" />
```

Modos: `fecha` · `fechaHora` · `hora` · `larga` · `corta` · `relativa`.
Renderiza un `<time>` con el instante ISO completo en `dateTime` y `title`, lo
que hace auditable un "hace 3 días".

Desde lógica de cliente: `useFormatearFecha()`, `usePreferenciasFecha()`,
`useTimeZone()`. Desde un Server Component:
`formatearFecha(valor, preferencias)` con las preferencias ya resueltas.

**No usar `format()` de date-fns ni `toLocaleDateString()` para fechas de
negocio**: ambos renderizan en la zona del proceso o del navegador. `date-fns`
se conserva solo para aritmética sobre `Date` ya correctos.

El `locale` está fijado en `es-PE`. Derivarlo de `idiomaPrincipal`/`pais`
cambiaría en silencio el texto de toda fecha ya visible en los tenants que no
son de Perú. Ojo que `es-PE` escribe "setiembre", la variante peruana.
`formatoFecha` y `formatoHora` de `ConfiguracionEmpresa` **sí** se respetan
(antes se guardaban y no se leían).

---

## Programaciones recurrentes

No hay scheduler recurrente todavía. `DisparadorJob.ejecutarEn` con
`lte: new Date()` es aritmética de instantes absolutos y ya es correcta.

Cuando se construya, el contrato de almacenamiento es:

> Una programación recurrente guarda `(reglaRecurrencia, horaLocal: "HH:mm",
> zonaHoraria: IANA)`. **Nunca** una hora UTC precomputada ni un offset fijo. La
> próxima ocurrencia se calcula al drenar, con las reglas vigentes de la zona —
> así un cambio de horario de verano o una actualización de la base IANA
> reprograman solos.

---

## Trampas conocidas

| Patrón | Qué hace mal | Usar |
|---|---|---|
| `new Date(\`${ymd}T00:00:00\`)` | Resuelve en la zona del proceso servidor | `desdeFechaCalendario(ymd, zona)` |
| `new Date("2026-09-17")` | Medianoche **UTC** = día anterior en toda América | `desdeFechaCalendario` / `parsearFechaImportada` |
| `.toISOString().slice(0, 10)` | Lee el día en UTC | `aFechaCalendario(fecha, zona)` |
| `.toISOString().slice(0, 16)` en un `datetime-local` | Pinta reloj UTC y se relee como local: **la hora se corre en cada edición** | `<InputFechaHora>` |
| `setHours(0,0,0,0)` | Medianoche en la zona del proceso | `rangoHoy(zona)` |
| `Math.floor((a - b) / 86400000)` | Ignora que un día con cambio de horario dura 23 o 25 h | `diasDeDiferenciaEnZona` |
| `format(d, "dd MMM yyyy", { locale: es })` | Zona del navegador | `<FechaHora>` / `formatearFecha` |
| `isToday(d)` / `isPast(d)` de date-fns | Zona del navegador | `esHoyEnZona` / `esPasadoEnZona` |
| `endOfDay(d)` + `lte` | Pierde filas en `.9995` | rango semiabierto `{ gte, lt }` |

---

## Tests

`src/shared/fechas/*.test.ts`. `vitest.config.ts` fija `TZ: "UTC"` para que la
suite sea determinista — antes heredaba la zona de la máquina de quien la
corría, que es justamente cómo se colaron estos bugs. Nada del código debe
depender de ese valor: se verificó que los tests pasan igual bajo
`Pacific/Auckland`, `America/Santiago`, `Europe/Madrid` y `UTC`.

Casos que valen la pena conocer:

- **`America/Santiago` 2026-04-05** — fall-back: la medianoche local ocurre dos
  veces. La corrección de una sola pasada devolvía las 23:00 del día anterior.
- **`America/Santiago` 2026-09-06** — spring-forward: la medianoche local **no
  existe** (salta de 00:00 a 01:00). Se devuelve el primer instante real del día.
- **Propiedad de contigüidad** — 400 días consecutivos × cada zona del catálogo:
  días estrictamente monótonos, de entre 23 y 25 h, y contiguos. Cubre todos los
  bordes de horario de verano sin enumerarlos.
