# Quickstart: validar la 041

Guía de validación de punta a punta. Detalle de reglas en [data-model.md](./data-model.md); firmas en [contracts/](./contracts/).

## Prerrequisitos

- Node 20+, PostgreSQL con `.env` configurado, rama `feature/041-contactos-segmentacion-comercial`.
- `npm run db:migrate` aplica la migración `*_contactos_segmentacion_comercial`.
- `npx tsx scripts/041-sembrar-interes-contactos.ts` (backfill + siembra). Correrlo **dos veces** y comprobar que la segunda no cambia ninguna fila (idempotencia).
- `npm run dev:full` (app + worker; el worker hace falta para la IA y los Workflows del escenario 6).

## Pruebas automáticas

```bash
npm run test:unit                 # reglas puras: condiciones, tramos, recomendación, cortes, servicio de clasificación
npm run test:e2e:contactos        # contactos.spec.ts + contactos-segmentacion.spec.ts (041)
npm run test:e2e:conversaciones   # aviso No contactar en el compositor; envío humano sigue funcionando
npm run test:e2e:pipeline         # obtenerContactos sin cambios (FR-036)
npm run test:e2e:pedidos          # selectores de contacto sin cambios (FR-036)
npm run build
```

Unit tests obligatorios (no borrar ninguno sin reemplazo):

| Caso | Esperado |
|---|---|
| Flujo con etapa "Entregado" marcada; contacto con pedido en "Nuevo" | no es Cliente |
| Flujo dinámico sin ninguna etapa marcada | 0 Clientes (no "todos") |
| Instancia sin flujo, pedido `ENTREGADO` | Cliente |
| Oportunidad abierta, interés `BAJO` **fijado** | no Interesado |
| Oportunidad abierta, interés `BAJO` **no fijado** | Interesado |
| Cliente con interés ALTO | Cliente **y** Interesado |
| Bordes de corte (referencia = corte) | lado "más reciente" |
| Interesado, interacción hace 4 / 9 días, defaults | Pendiente / Por recuperar |
| Ídem con actividad pendiente futura | Al día |
| Lead sin señales, 70 días | Inactivo, nunca Por recuperar |
| Interesado "No contactar", 9 días | no Por recuperar |
| `esperandoRespuestaDesde` no nulo | Pendiente, tramo T1, recomendación RESPONDER (o NO_CONTACTAR si aplica) |
| Paginación por tramos: página que cruza T1→T2 y T3→T4 | filas correctas, sin duplicados ni huecos |
| Servicio: pasar de No contactar a Contactable con origen IA | rechazado |
| Servicio: escribir interés con origen IA sobre valor fijado | rechazado, sin cambios |
| `calculo-objetivo` (012) con flujo dinámico | cuenta compras por `cuentaComoVenta` |
| `enviarMensajeInterno` `autor: "IA"` a contacto No contactar | `ok: false`, no crea mensaje |
| `enviarMensajeInterno` `autor: "PERSONA"` a contacto No contactar | `ok: true` |
| `registrarInteraccion` con fecha anterior a la guardada | no retrocede |

## Escenarios manuales

Preparar en una instancia de prueba: un flujo con "Nuevo", "Entregado" (Cuenta como Venta) y "Cancelado"; contactos A (pedido Entregado), B (pedido solo en Nuevo), C (oportunidad abierta, sin pedidos), D (cliente con interés Alto), E (Interesado sin actividad hace 9 días), F (con mensaje entrante sin responder), G (Lead creado hace 70 días).

1. **Indicadores y segmentos (H1)** — Abrir `/crm/contactos`. A y D cuentan en Clientes; B no. C y D en Interesados. E en Por recuperar. G en Leads. Clic en "Clientes": tabla filtrada, indicador y pestaña resaltados. Ícono de información explica la superposición.
2. **Cuenta como Venta en vivo (H1, escenario 3)** — Marcar "Nuevo" como Cuenta como Venta en el Flujo de Venta, volver: B pasa a Cliente sin recálculo. Desmarcar: vuelve.
3. **Orden por prioridad (FR-012)** — Sin tocar el orden, F aparece primero, luego los Pendientes, luego E, luego el resto. Cambiar a "Nombre" y volver a "Prioridad".
4. **Búsqueda y paginación (H1, escenarios 6–7)** — Buscar un fragmento de teléfono y de email. Con filtros activos ir a página 2 y volver: filtros intactos. "Limpiar": vista por defecto.
5. **Panel lateral (H2)** — Clic en A: panel con última compra, oportunidades, actividades pendientes, "Análisis de IA: Sin analizar". La lista conserva filtros y página al cerrar. "Abrir ficha completa" abre `/crm/contactos/[id]` sin cambios.
6. **Interés y No contactar (H2)** — Fijar C en Bajo: deja de ser Interesado; el historial muestra el cambio. Marcar E "No contactar": sale de Por recuperar. Con la IA activa en la etapa de E, enviar un mensaje simulado desde E: la IA no responde (log `[OrquestarIA]`). Un Workflow con espera que debía escribirle termina sin reintentos. Abrir la conversación de E como vendedor: aviso visible; el envío manual sale.
7. **Solo lectura (H2, escenario 10)** — Con un usuario de rol solo lectura de contactos: panel visible, controles de interés y preferencia ausentes; la acción del servidor responde error si se invoca igual.
8. **Umbrales (H3)** — En Configuración → Preferencias cambiar a 2 / 5 / 30: E (9 días) sigue Por recuperar y G (70 días) Inactivo; un contacto Interesado con interacción hace 6 días pasa de Pendiente (con 3/7) a Por recuperar (con 2/5), y el indicador "Por recuperar" sube en uno. Intentar 7 / 3 / 60: rechazado con mensaje y se conservan los valores anteriores.
9. **Móvil (FR-018)** — Viewport 375 px: indicadores sin scroll horizontal de página, filas como tarjetas, panel a pantalla completa.
10. **Aislamiento (FR-033)** — Desde otra instancia, invocar `obtenerResumenContactoAction` con el id de A: "Contacto no encontrado".

## Rendimiento (SC-003, DT-01)

Sembrar 20.000 contactos en una instancia de prueba (con ~30 % con pedidos, ~20 % con oportunidades, ~5 % con mensaje sin responder) y medir en el servidor `cargarVistaContactos`:

- Primera carga (indicadores + página 1, orden por prioridad): < 2 s.
- Cambio de página, de filtro o de orden: p95 < 1 s.

Si no cumple, registrar en `research.md` (DT-01) los `EXPLAIN ANALYZE` de los `count` más lentos antes de cambiar el diseño.
