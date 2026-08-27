# Data Model: Diagnóstico claro de envíos de Instagram fuera de la ventana de 24h

**Feature**: `004-fix-instagram-human-agent` | **Date**: 2026-08-27

No se agregan columnas, tablas ni campos nuevos — todos los datos que esta feature necesita mostrar ya existen en el modelo actual (`MensajeConversacion.codigoError`/`.motivoError`, `Conversacion.cuentaCanalId`). Este documento describe cómo se interpretan esos datos ya existentes para cumplir los FR de `spec.md`.

## Entidades existentes involucradas (sin cambios de esquema)

- **MensajeConversacion**: ya tiene `estado` (incluye `FALLIDO`), `codigoError`, `motivoError`, `fechaError`. Esta feature solo cambia cómo se **presentan** `codigoError`/`motivoError` al agente — no se modifica cómo ni cuándo se escriben.
- **Conversacion**: ya tiene `cuentaCanalId` (indexado), usado para agrupar mensajes fallidos por cuenta de Instagram en la consulta de D3.
- **CuentaCanal**: representa la cuenta de Instagram conectada; sin cambios — solo se le suma información derivada (no persistida) al renderizar el panel.

## Mapeo `codigoError` → presentación (FR-002, FR-003 — decisión D2 en `research.md`)

| Familia | `codigoError` | Origen del texto mostrado | Implica acción externa a Karia |
|---|---|---|---|
| Requiere acción con Meta | `HUMAN_AGENT_NO_APROBADO` | `motivoError` ya persistido (sin cambios) | Sí — gestionar aprobación en Meta for Developers |
| Requiere acción con Meta | `FUERA_VENTANA_MENSAJERIA` | `motivoError` ya persistido | Sí — ventana vencida, no hay acción posible en Karia para ese mensaje |
| Requiere acción con Meta | `PERMISO_DENEGADO_META` | `motivoError` ya persistido | Sí — permiso no habilitado en la integración |
| Requiere acción en Karia | `TOKEN_INVALIDO` | `motivoError` ya persistido (ya menciona "reconectar") | No — se resuelve reconectando la cuenta en Integraciones |
| Transitorio/desconocido | `RATE_LIMIT`, `ERROR_TEMPORAL_META`, `ERROR_RED`, `RESPUESTA_INESPERADA`, `ERROR_DESCONOCIDO_META` | `motivoError` ya persistido | No aplica — se agotaron los reintentos automáticos |
| Sin código (legacy/otros) | `null`/desconocido | Texto genérico de respaldo ("No se pudo entregar el mensaje") | — |

_El texto exacto de cada `motivoError` ya está definido en `src/conversaciones/errores.ts` y `src/conversaciones/providers/instagram.ts` — esta feature no redacta mensajes nuevos, solo decide cómo agruparlos visualmente._

## Consulta derivada: estado de Human Agent por cuenta (FR-004 — decisión D3)

No es una entidad nueva, es una agregación de solo lectura:

```text
Para una CuentaCanal (canal = "instagram"):
  contar MensajeConversacion
    donde Conversacion.cuentaCanalId = <la cuenta>
      Y MensajeConversacion.codigoError = "HUMAN_AGENT_NO_APROBADO"
      Y MensajeConversacion.fechaError >= (hoy - 30 días)
```

Resultado mostrado en `panel-instagram.tsx` junto a la cuenta:
- `0` → "Sin rechazos de Human Agent en los últimos 30 días" (tono neutro/positivo)
- `> 0` → "N mensajes rechazados por falta de aprobación de Human Agent en los últimos 30 días" (tono de advertencia, con indicación de gestionar la aprobación en Meta)

## Reglas de validación (heredadas del FR, no nuevas)

- La presentación del error MUST usar exclusivamente `codigoError`/`motivoError` ya persistidos — no debe inferir ni adivinar un motivo a partir de texto libre de Meta (FR-002/FR-003, coherente con la razón original de tener `codigoError` como slug estable — ver comentario en `errores.ts`).
- La consulta de D3 MUST ser de solo lectura y no debe alterar ningún mensaje ni disparar reintentos (FR-005 — no tocar la lógica de envío).
