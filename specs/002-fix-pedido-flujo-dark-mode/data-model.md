# Data Model: Corrección de colores en modo oscuro — Edición de pedido y regla de flujo de venta

**Feature**: `002-fix-pedido-flujo-dark-mode` | **Date**: 2026-08-27

Igual que en `001-fix-cotizacion-dark-mode`, esta feature no crea ni modifica entidades de negocio — es un cambio puramente visual (FR-005). El "modelo" relevante es el mapeo de tokens (heredado) y el inventario de superficies afectadas en estos dos archivos.

## Entidades de negocio (sin cambios)

- **Pedido**: entidad existente (`prisma.pedido`). Sus campos, estados y relaciones no cambian.
- **FlujoVentaRegla**: entidad existente que define condiciones de transición de etapa. Su lógica de evaluación no cambia.

## Mapeo de tokens (heredado de `001-fix-cotizacion-dark-mode/data-model.md`, + 3 casos nuevos)

| Rol | Clase(s) de paleta fija actual | Token semántico destino | Origen |
|---|---|---|---|
| Superficie del panel (Sheet) | `bg-white dark:bg-stone-950` | `bg-modal` | D1 (heredado) |
| Borde del panel / secciones / tabla | `border-stone-100/200/300`, `dark:border-white/N` | `border-border` | D3 (heredado) |
| Texto principal | `text-stone-900`, `text-stone-100` | `text-foreground` | D2 (heredado) |
| Texto secundario / deshabilitado | `text-stone-300/400/500/600/700` | `text-muted-foreground` | D2 (heredado) |
| Superficie recesada (fondo de tabla, tarjetas, footer de totales) | `bg-stone-50`, `dark:bg-white/[0.0N]` | `bg-muted` | D4 (heredado) |
| Hover de botón-ícono / botón colapsable | `hover:bg-stone-100 dark:hover:bg-white/N` | `hover:bg-muted` | D6 (heredado) |
| Separador visual (`<Separator>`) | `bg-stone-200 dark:bg-white/10` | `bg-border` | **D8 (nuevo)** |
| Tarjeta informativa con acento lima | `border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5` | **Sin cambio** — mismo patrón D7 | **D9 (nuevo)** |
| Acento de acción principal (botón guardar/publicar, spinner) | `bg-lime-*`, `text-stone-950` sobre CTA | **Sin cambio** — D7 heredado | D7 (heredado) |
| Badge de resultado de prueba (Cumple/No cumple) | `emerald-*`, `red-*` | **Fuera de alcance** (ver FR-008) | **D10 (nuevo, no se aplica en esta feature)** |

_Rationale completo de cada fila: ver `research.md` de esta feature y de `001-fix-cotizacion-dark-mode`._

## Inventario de superficies afectadas (por archivo)

| Archivo | Ocurrencias de paleta fija a reemplazar | Punto de entrada |
|---|---|---|
| `src/sales/pedidos/components/dialog-editar-pedido.tsx` | 57 | Editar pedido existente (US1) |
| `src/sales/flujo-venta/components/sheet-regla-validacion.tsx` | 65 (sin contar las 4 de `emerald-*`/`red-*`, fuera de alcance por FR-008) | Nueva regla / Editar regla de una etapa (US2) |

Total: 122 ocurrencias de paleta fija a reemplazar según el mapeo de arriba.

## Reglas de validación (heredadas del FR, no nuevas)

- Ningún archivo tocado en esta feature MUST introducir un nuevo valor hex/rgb ni una nueva clase `stone-*`/`zinc-*`/`gray-*`/`black`/`white` literal tras el cambio (FR-007).
- El comportamiento (guardado de pedido, guardado/publicación de regla, evaluación de prueba) no cambia — solo las clases CSS de presentación (FR-005).
- El badge `emerald-*`/`red-*` de resultado de prueba se deja intacto en esta feature (FR-008, D10).
