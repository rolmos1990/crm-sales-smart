# Quickstart: validar Preparación de pedidos

**Feature**: 026-preparacion-pedidos | **Fecha**: 2026-09-17

Guía para levantar la feature y comprobar, a mano y con tests, que cumple lo que dice el spec. No contiene
código de implementación — eso vive en `tasks.md` y en el código.

---

## Prerequisitos

- Node 20.19+ (`.nvmrc`)
- `npm install` — **el repo no tiene `node_modules` instalado**, hay que hacerlo antes de cualquier cosa
- `.env` con `DATABASE_URL` y `DIRECT_URL` (el proyecto apunta a Postgres/Supabase)
- Una instancia con al menos un Flujo de Venta activo con etapas, y varios pedidos con `fechaEntrega` de hoy

## Setup

```bash
npm install
npm run db:migrate          # aplica la migración aditiva de esta feature
npm run db:seed             # opcional: datos de prueba
npm run dev
```

La migración es aditiva (campos nullables o con default, ninguna columna existente cambia), así que no
requiere backfill ni ventana de mantenimiento — ver `data-model.md`, "Nota de migración".

---

## Validación manual

### 1. Funciona sin configurar nada (FR-003, SC-001)

1. Entrar a `/sales/preparacion` con una instancia que nunca usó el módulo.
2. **Esperado**: el tablero abre con dos columnas ("Por preparar", "Preparado"), con los pedidos de hoy ya
   distribuidos en la primera. Ninguna pantalla de configuración obligatoria de por medio.
3. Arrastrar un pedido a "Preparado".
4. **Esperado**: la tarjeta se mueve, y en el detalle del pedido aparecen inicio, fin y tu nombre como
   responsable.

### 2. Estados configurables (FR-001, FR-002, SC-002)

1. Abrir "Configurar vista" → agregar dos estados más ("Preparando" con *marca inicio*, "Listo para despacho").
2. Reordenar las columnas.
3. **Esperado**: el tablero muestra cuatro columnas en el orden elegido, y ningún pedido en curso perdió su
   estado.

### 3. Sellado de fechas y responsable (FR-012 a FR-015)

| Paso | Esperado |
|------|----------|
| Mover un pedido a "Preparando" (`marcaInicio`) | Se registra el inicio |
| Volver a moverlo a "Preparando" más tarde | El inicio **no** se re-sella |
| Mover al estado final | Se registran fin y responsable (el usuario que movió) |
| Retroceder desde el final | Fin y responsable se limpian; el historial conserva ambos movimientos |

### 4. Conflicto por movimiento simultáneo (FR-017, SC-006)

1. Abrir el tablero en dos navegadores (o dos pestañas con sesiones distintas).
2. Mover la misma tarjeta en ambos, uno después del otro sin refrescar el segundo.
3. **Esperado**: el primero aplica; el segundo recibe un aviso claro y la pantalla actualizada. En la base
   hay exactamente un movimiento nuevo en `PreparacionHistorial`, no dos.

### 5. Entrada y salida del tablero (FR-006 a FR-009)

1. Configurar que solo la etapa "Confirmado" haga entrar pedidos.
2. **Esperado**: un pedido en "Pendiente" no aparece; al moverlo a "Confirmado" aparece en la primera columna.
3. Crear un pedido nuevo que nazca directamente en "Confirmado" (desde cotización aprobada o desde
   `/sales/pedidos/nuevo`).
4. **Esperado**: aparece en el tablero. Este es el caso que falla si la pertenencia se resolviera con un hook
   en el motor de etapas — ver `research.md`, Decisión 1.
5. Mover el pedido a una etapa final o cancelarlo.
6. **Esperado**: desaparece del tablero, pero su registro de preparación sigue existiendo (verificable en
   Prisma Studio: `npm run db:studio`).

### 6. Visibilidad en Pedidos (FR-024 a FR-026, SC-004)

1. Abrir `/sales/pedidos`.
2. **Esperado**: los pedidos del tablero muestran su chip de preparación, subordinado al badge de etapa.
3. Abrir el detalle de uno.
4. **Esperado**: bloque "Preparación (armado)" separado del bloque de Entrega, con etiquetas que no se
   confunden entre sí (FR-036a).
5. Abrir un pedido que nunca entró a preparación.
6. **Esperado**: la fila y el detalle se ven exactamente como antes de esta feature (FR-026, SC-008).

### 7. Avance por ítem y resumen por producto (FR-027 a FR-032, SC-007)

1. En un pedido de tres líneas, marcar dos completas y una parcial (2 de 3).
2. **Esperado**: la tarjeta refleja el avance y el pedido no figura como completo.
3. Intentar registrar más unidades que las pedidas.
4. **Esperado**: rechazado con mensaje claro.
5. Ver el resumen por producto del rango.
6. **Esperado**: por cada producto, unidades requeridas y ya preparadas, consolidadas de todos los pedidos.
7. Editar el pedido y agregarle una línea.
8. **Esperado**: el pedido vuelve a figurar con avance incompleto, sin perder historial.

### 8. Rangos y pedidos sin fecha (FR-018, FR-019)

1. Recorrer las pestañas Hoy / Mañana / Esta semana / Personalizado.
2. **Esperado**: los contadores de cada pestaña coinciden con lo que se muestra al abrirla, y "hoy" es el
   mismo "hoy" que usa `/sales/pedidos` (probar cerca de medianoche si se puede, o cambiando la zona horaria
   de la empresa en Configuración).
3. **Esperado**: un pedido sin fecha de entrega sigue visible en la agrupación "Sin fecha" en cualquier rango.

### 9. Permisos (FR-033, FR-034)

1. Entrar con un rol que no tenga acceso a `preparacion`.
2. **Esperado**: redirección a `/acceso-denegado` y ausencia del ítem "Preparación" en el sidebar.
3. **Esperado**: ningún dato de otra instancia visible en el tablero (tenencia acotada por sesión).

---

## Tests automatizados

```bash
npm run test:unit                                    # Vitest — lógica pura
npx playwright test tests/e2e/sales/preparacion.spec.ts   # E2E del tablero
npx playwright test tests/e2e/sales/pedidos.spec.ts       # no regresión del listado
npm run build                                        # el build debe pasar limpio
```

**Vitest cubre**: las cuatro reglas de sellado de fechas, el cálculo de avance derivado del pedido, la
validación `cantidadPreparada <= cantidad`, y la resolución del rango "esta semana".

**Playwright cubre**: mover una tarjeta extremo a extremo, ver el chip en la lista de pedidos, y la no
regresión de lista y detalle para una instancia sin preparación.

---

## Verificación de eventos

```bash
npx playwright test tests/e2e/sistema/eventos.spec.ts
```

**Esperado**: al completar una preparación se publica `PREPARACION_COMPLETADA` una sola vez; mover entre
estados intermedios no publica nada (ver `contracts/eventos.md`, "Lo que NO emite evento").
