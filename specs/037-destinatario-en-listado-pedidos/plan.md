# Implementation Plan: Mostrar quién recibe en el listado de Pedidos

**Branch**: `feature/037-destinatario-en-listado-pedidos` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

## Summary

La columna "Cliente" del listado de Pedidos suma, debajo del nombre, un chip `Recibe: <destinatario>` cuando el pedido tiene uno. El dato sale del join con `EntregaPedido` que el listado ya hace para "Método de envío": una columna más en el `select` y un chip en la celda.

## Módulos afectados

| Módulo | Archivo | Cambio |
|---|---|---|
| Sales / Pedidos | `src/sales/pedidos/queries.ts` | `incluirRelaciones.entrega.select` suma `nombreDestinatario` |
| Sales / Pedidos | `src/sales/pedidos/types.ts` | `Pedido.entrega` refleja el campo nuevo |
| Sales / Pedidos (UI) | `src/sales/pedidos/components/lista-pedidos.tsx` | La celda de "Cliente" renderiza el chip |

Sin cambios en el schema de Prisma, Server Actions, eventos, filtros ni KPIs. Sin migración.

## Decisiones

Las cuatro decisiones de diseño (de dónde sale el dato, dónde se muestra, qué pasa si coincide con el cliente, cómo se acotan los textos largos) están en [research.md](./research.md), con los datos de producción que las respaldan.

## Tests (proporcionales al riesgo — Principio V)

Sin tests automatizados nuevos. Es un cambio presentacional sin lógica de negocio: no hay regla, cálculo ni escritura que verificar, y el corredor unitario del proyecto (`vitest`, `environment: node`) no monta componentes React. La validación es `quickstart.md`, con un escenario explícito de cero regresión, más `npx tsc --noEmit` y la suite unitaria existente para confirmar que el cambio de tipo no rompe nada.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Un destinatario largo desacomoda la tabla | `max-w` + `truncate` + `title` (Decisión 4); escenario 3 del quickstart |
| Las filas sin destinatario cambian de alto o muestran una etiqueta vacía | Se chequea el valor ya recortado antes de renderizar; escenario 2 del quickstart |
| El chip compite visualmente con el badge de estado | Reusa el lenguaje del chip de preparación, deliberadamente subordinado (Decisión 2) |
