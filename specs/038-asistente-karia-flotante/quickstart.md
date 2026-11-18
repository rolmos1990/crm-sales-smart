# Quickstart: validar el Asistente Karia

## Prerrequisitos

- Node 20+, dependencias instaladas (`npm install`), base local con usuario de prueba (`npm run db:seed:test`).
- Fuente de la ilustración copiada a `assets/asistente/KariAI.png`.

## 1. Generar el sprite

```bash
npx tsx scripts/generar-sprite-karia.ts
# Fuente ya transparente (plan B):
npx tsx scripts/generar-sprite-karia.ts --ya-transparente
```

**Esperado**: `public/asistente/karia-sprite.webp` (3072×192, < 150 KB) y una vista previa sobre fondo a cuadros y oscuro, en la ruta que imprime el script. Revisar: 16 frames alineados, fondo transparente, casco intacto, sin halo blanco.

## 2. Tests unitarios

```bash
npx vitest run src/asistente
```

**Esperado**: pasan las reglas de [data-model.md](./data-model.md#reglas-de-validación-cubiertas-por-animaciontestts) (frames en rango, intervalo de pestañeo 3–6 s, `success` < 2 s, pestañeo solo en idle+neutral, frame fijo para reduced-motion).

## 3. Recorrido manual

```bash
npm run dev
```

| Paso | Esperado |
|---|---|
| Iniciar sesión y abrir `/crm` | Mascota abajo a la derecha, flotando, moviendo la cabeza; pestañea ~cada 3–6 s. |
| Cambiar tema claro ↔ oscuro | Sin recuadro ni halo; legible sobre tablas y cards. |
| Clic en la mascota (y luego Tab + Enter) | Rebote con ojos felices y globo "Hola, soy Karia…"; Escape cierra y devuelve el foco. |
| Abrir `/crm/inbox` | La mascota no aparece; el compositor queda libre. |
| Abrir `/login` en ventana privada | La mascota no aparece. |
| Abrir `/dev/karia` | Vitrina con varias instancias (`idle`/`happy`/`calm`/`thinking`/`success`, con y sin pestañeo, 3 tamaños) y botones que llaman `pensar()`, `celebrar()`, `reposar()` sobre el flotante; cada instancia se comporta de forma independiente. |
| Activar "reducir movimiento" en el SO | Nada flota ni rebota; cada estado es una imagen fija. |
| Vista previa de impresión de una cotización | La mascota no sale. |
| Ventana a 375 px de ancho | Mascota más chica, sin scroll horizontal. |

## 4. E2E

```bash
npx playwright test tests/e2e/asistente/asistente-karia.spec.ts
```

**Esperado**: visible con sesión en `/crm` y `/sales/pedidos`; ausente en `/login` y `/crm/inbox`; abre y cierra el popover con teclado; `data-state` pasa a `success` al clic y vuelve a `idle` en < 2 s.

## 5. Build

```bash
npx tsc --noEmit && npm run build
```

**Esperado**: sin errores; `/dev/karia` responde 404 en el build de producción.
