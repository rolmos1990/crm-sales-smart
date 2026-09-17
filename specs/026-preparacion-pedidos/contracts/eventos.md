# Contracts: Eventos de dominio — Preparación

**Feature**: 026-preparacion-pedidos | **Fecha**: 2026-09-17

Tres eventos nuevos. Nombres en pasado, contrato único compartido por publicador y suscriptor, sin DTOs
duplicados (regla 7 del proyecto). El sobre `EventoDominio` de `src/eventos/contratos/base.event.ts` ya
aporta `version: number`, `idEvento`, `fechaOcurrencia` e `instanciaId`, así que el payload no los repite.

---

## Catálogo — `src/eventos/catalogo.ts`

Se agrega un bloque nuevo a `EventosSistema`, después de `// Pedidos`:

```ts
  // Preparación
  PreparacionIniciada:    "PREPARACION_INICIADA",
  PreparacionCompletada:  "PREPARACION_COMPLETADA",
  LineaPedidoPreparada:   "LINEA_PEDIDO_PREPARADA",
```

Los nombres se usan siempre desde estas constantes, nunca como string literal.

---

## `PreparacionIniciada`

Se publica cuando se sella `iniciadaEn` — es decir, la primera vez que el pedido entra a un estado con
`marcaInicio`, o al materializarse la preparación si ningún estado tiene esa marca.

```ts
// src/eventos/contratos/preparacion-iniciada.event.ts
export interface PreparacionIniciadaPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  estadoId: string;
  estadoNombre: string;
  iniciadaEn: string;          // ISO 8601
  usuarioId: string | null;
}
```

Se publica **una sola vez** por preparación: retroceder y volver a avanzar no vuelve a emitirlo, porque
`iniciadaEn` no se re-sella.

---

## `PreparacionCompletada`

Se publica al entrar al estado `esFinal`.

```ts
// src/eventos/contratos/preparacion-completada.event.ts
export interface PreparacionCompletadaPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  estadoId: string;
  estadoNombre: string;
  iniciadaEn: string | null;   // ISO 8601
  completadaEn: string;        // ISO 8601
  asignadaAId: string | null;  // quien movió el pedido al estado final
  avanceCompleto: boolean;     // si todas las líneas quedaron preparadas
}
```

`avanceCompleto` viaja en el payload porque un suscriptor no puede derivarlo sin consultar todas las líneas,
y porque marcar ítems no es requisito para cerrar la preparación (spec, Assumptions).

**Retroceso**: salir del estado final **no** emite evento en esta versión. Si un suscriptor necesitara
reaccionar a la reapertura, se agregaría `PreparacionReabierta` como contrato nuevo, sin cambiar estos.

---

## `LineaPedidoPreparada`

Se publica cuando una línea alcanza su cantidad completa (`cantidadPreparada === cantidad`). Los avances
parciales **no** emiten evento — evitaría inundar la cola con un mensaje por clic.

```ts
// src/eventos/contratos/linea-pedido-preparada.event.ts
export interface LineaPedidoPreparadaPayload extends Record<string, unknown> {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  pedidoLineaId: string;
  productoId: string | null;
  cantidad: number;
  preparadaPorId: string | null;
}
```

---

## Lo que NO emite evento

- Movimientos entre estados intermedios (arrastrar de "Por preparar" a "Preparando" con `marcaInicio` ya
  sellado): quedan en `PreparacionHistorial`, que es la fuente para auditoría y actividad reciente.
- Cambios de configuración (crear/renombrar/reordenar estados, cambiar etapas de entrada).
- Salida del pedido del tablero por alcanzar etapa final del flujo de venta: ese evento ya lo cubre el
  flujo de venta, no se duplica.

---

## Orden de publicación

Los eventos se publican **después** de que la transacción de base commitea (constitución III: los efectos
secundarios corren solo si la operación primaria tuvo éxito). Un fallo al publicar no revierte el
movimiento del pedido ni el avance de la línea.

---

## Documentación

Los tres eventos se agregan a `docs/eventos.md` con su payload y su disparador, siguiendo el formato de los
eventos ya documentados.
