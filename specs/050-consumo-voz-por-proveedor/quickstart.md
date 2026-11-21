# Quickstart: verificar el consumo de voz por proveedor

**Feature**: `050-consumo-voz-por-proveedor` | **Date**: 2026-11-21

Cómo comprobar que la feature funciona, de punta a punta. Los tests automáticos cubren la
aritmética ([contracts/consumo-voz.md](./contracts/consumo-voz.md)); esto cubre lo que solo se ve
en pantalla.

## Prerequisitos

- Base de datos corriendo y migrada (`npm run db:migrate`). **Esta feature no agrega migración**:
  si `prisma migrate` propone algo, hay un cambio de esquema que no debería estar ahí.
- Una cuenta con al menos **dos** proveedores de voz configurados y con credencial válida
  (Configuración → Voz → Agregar). Con uno solo no se puede ver si el desglose discrimina.
- El interruptor de transcripción encendido.
- Al menos una conversación por la que se puedan recibir notas de voz.

## Comandos

```bash
npm run dev                       # app Next.js
npm run test:unit -- src/configuracion/voz  # los tests unitarios de esta feature
npm run build                     # debe pasar; la Constitución lo exige antes de dar por hecho
```

El worker tiene que estar corriendo para que las notas de voz se transcriban. Esta feature **no
corre en el worker** —es una pantalla de configuración—, pero sin worker no se genera el consumo
que hay que mirar.

---

## Escenario 1 — Desglose básico (US1, FR-001/FR-002)

1. Mandá notas de voz a la cuenta hasta tener consumo. Para forzar que entren por proveedores
   distintos, subí la prioridad de uno, mandá un audio, bajala y subí la del otro, mandá otro.
2. Abrí **Configuración → Voz**.

**Esperado**: cada fila de proveedor muestra, bajo la línea de servicio/modelo/prioridad, sus
minutos y costo del mes. Sin clics, sin filtros, sin spinner.

**Qué invalidaría el resultado**: que la cifra aparezca solo después de un parpadeo o de
interactuar. Eso significa que se coló carga en el cliente y viola FR-013.

## Escenario 2 — Las cifras cuadran (FR-004)

Sumá a mano los minutos de todas las filas, incluida la de "Proveedor eliminado" si está.

**Esperado**: el resultado es **exactamente** el de la tarjeta "Minutos transcritos". Lo mismo con
el costo contra "Costo estimado del mes", contando solo las filas con monto.

Este es el escenario que el reparto de redondeo existe para sostener. Si da 36.9 contra 37.0, el
reparto no se está aplicando o se aplica después de redondear.

## Escenario 3 — Proveedor sin tarifa (US3, FR-006)

1. Editá uno de los proveedores y dejá **vacío** el costo por hora.
2. Mandá una nota de voz que caiga en ese proveedor.
3. Recargá la pestaña.

**Esperado**: su fila muestra los minutos reales y, donde iría el monto, "sin tarifa cargada".

**Lo que NO debe pasar**: un `0`, un `0.00` o un guion sin explicación. Un cero se lee como "este
servicio sale gratis", que es justamente el malentendido que FR-006 corrige.

4. Cargale ahora la tarifa y mandá otra nota de voz.

**Esperado**: la fila pasa a mostrar monto, advirtiendo que cubre parte del mes —las
transcripciones previas a la carga quedaron sin costo y no se recalculan—. El total de la tarjeta
tampoco las incluye: mismo criterio de siempre.

## Escenario 4 — Proveedor eliminado (US2, FR-005)

1. Anotá los minutos del mes de uno de los proveedores con consumo.
2. Eliminalo con el botón de papelera.
3. Recargá la pestaña.

**Esperado**: al final de la lista aparece una entrada "Proveedor eliminado" con esos minutos y
ese costo, sin botones de acción. La tarjeta de total **no bajó**. La suma del escenario 2 sigue
cuadrando.

4. Eliminá un segundo proveedor que también tenía consumo.

**Esperado**: una **sola** entrada "Proveedor eliminado", con la suma de los dos. No dos
entradas, no un intento de nombrarlos.

## Escenario 5 — Proveedor sin consumo y cuenta nueva (FR-007)

1. Agregá un proveedor nuevo y no lo uses.

**Esperado**: su fila dice "Sin consumo este mes". No está vacía ni oculta.

2. En una cuenta recién creada, sin ninguna transcripción, abrí la pestaña.

**Esperado**: las tarjetas en cero y las filas en "Sin consumo este mes". Sin error, sin huecos,
sin `NaN`.

---

## Verificaciones que no se ven en pantalla

### Zona horaria del corte (FR-009)

En **Configuración → Empresa**, cambiá la zona horaria del negocio a una con varias horas de
diferencia y recargá la pestaña de Voz cerca de un cambio de mes.

**Esperado**: el desglose y las tarjetas se mueven **juntos**. Si una cifra cambia y la otra no,
hay dos ventanas distintas en juego y la igualdad de FR-004 es casualidad.

### Aislamiento entre cuentas (FR-010)

Con dos cuentas con consumo, entrá a cada una.

**Esperado**: cada una ve solo lo suyo. Si una cuenta ve el consumo de otra, es un fallo de
seguridad, no un bug de presentación.

### Credenciales (FR-012)

Con la pestaña abierta, mirá el HTML servido (`view-source:` o la pestaña Network del navegador)
y buscá `apiKey`.

**Esperado**: cero coincidencias, también en el payload de React Server Components.

### Sin regresión en las tarjetas (FR-003)

Antes de desplegar, anotá los dos valores de las tarjetas. Después del cambio, con el mismo dato,
tienen que ser **idénticos** — mismo número, mismo texto de detalle, mismo formato.

### Rendimiento (SC-005)

En la pestaña Network, compará el tiempo de respuesta del documento antes y después.

**Esperado**: sin diferencia perceptible. La feature cambia una consulta por otra, no agrega
viajes a la base. Si se nota más lenta, corré `EXPLAIN ANALYZE` del `groupBy` y confirmá que usa
el índice `[instanciaId, creadoEn]` (Decisión 6 de [research.md](./research.md)).

### El tope diario sigue funcionando

El límite de minutos por día lee `UsoVoz` por su cuenta (`src/voz/limites.ts`) y esta feature no
lo toca. Si configuraste un tope, verificá que sigue cortando: es la otra lectura de la misma
tabla y conviene confirmar que nadie la arrastró en la refactorización.
