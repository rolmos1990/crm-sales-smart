# Guía de Ejecución de Pruebas E2E — Vento CRM

## Requisitos previos

- Node.js 20+
- La aplicación Vento corriendo (local, staging o producción)
- Usuarios de prueba creados en el ambiente a testear (uno por cada rol)

---

## Instalación (primera vez)

```bash
# Instalar dependencias del proyecto (ya incluye @playwright/test)
npm install

# Instalar el navegador Chromium
npx playwright install chromium
```

---

## Configurar el ambiente

Edita el archivo `.env.test` en la raíz del proyecto:

```env
# URL del ambiente a probar
BASE_URL=http://localhost:3000

# Credenciales por rol (deben existir en el ambiente indicado)
TEST_OWNER_EMAIL=owner@tuempresa.com
TEST_OWNER_PASSWORD=tu_password

TEST_ADMIN_EMAIL=admin@tuempresa.com
TEST_ADMIN_PASSWORD=tu_password

TEST_AGENTE_VENTAS_EMAIL=agente.ventas@tuempresa.com
TEST_AGENTE_VENTAS_PASSWORD=tu_password

TEST_EJECUTIVO_VENTAS_EMAIL=ejecutivo@tuempresa.com
TEST_EJECUTIVO_VENTAS_PASSWORD=tu_password

TEST_SUPERVISOR_EMAIL=supervisor@tuempresa.com
TEST_SUPERVISOR_PASSWORD=tu_password

TEST_AGENTE_SOPORTE_EMAIL=soporte@tuempresa.com
TEST_AGENTE_SOPORTE_PASSWORD=tu_password

TEST_INVITADO_EMAIL=invitado@tuempresa.com
TEST_INVITADO_PASSWORD=tu_password
```

Para apuntar a staging o producción solo cambia `BASE_URL`:

```env
BASE_URL=https://staging.vento.com
```

---

## Comandos de ejecución

### Ejecutar todos los tests

```bash
npm run test:e2e
```

Esto corre primero el **setup de autenticación** (hace login con cada rol y guarda la sesión), luego ejecuta los 174 tests de todos los módulos.

---

### Ejecutar tests de un módulo específico

```bash
# Solo CRM - Contactos
npx playwright test tests/e2e/crm/contactos.spec.ts

# Solo Autenticación
npx playwright test tests/e2e/auth/autenticacion.spec.ts

# Solo Sales
npx playwright test tests/e2e/sales/

# Solo Configuración
npx playwright test tests/e2e/configuracion/
```

---

### Ejecutar un test individual por nombre

```bash
# Por ID del caso (ej: C-04)
npx playwright test --grep "C-04"

# Por nombre parcial
npx playwright test --grep "crear contacto mínimo"

# Todos los tests de permisos
npx playwright test --grep "SUPERVISOR"
```

---

### Modo UI interactivo (recomendado para depurar)

```bash
npm run test:e2e:ui
```

Abre una interfaz visual donde puedes:
- Ver cada test paso a paso
- Reproducir fallos con capturas de pantalla
- Inspeccionar el DOM en cada acción
- Filtrar y ejecutar tests individuales

---

### Ver el reporte HTML tras la ejecución

```bash
npm run test:e2e:report
```

Abre el reporte en el navegador con:
- Estado de cada test (pasó / falló / saltado)
- Capturas de pantalla en fallos
- Videos de los tests fallidos
- Trazas paso a paso

---

### Ejecutar con el navegador visible

```bash
npm run test:e2e:headed
```

Útil para ver qué está haciendo el browser durante la prueba.

---

## Ejecutar contra distintos ambientes

No es necesario cambiar ningún código. Solo cambia `BASE_URL`:

```bash
# Contra producción
$env:BASE_URL="https://app.vento.com"; npm run test:e2e

# Contra staging
$env:BASE_URL="https://staging.vento.com"; npm run test:e2e

# Contra localhost en puerto diferente
$env:BASE_URL="http://localhost:3001"; npm run test:e2e
```

> **Nota**: Los usuarios de prueba deben existir en el ambiente que indiques en `BASE_URL`.

---

## Estructura de los tests

```
tests/
├── e2e/
│   ├── auth/
│   │   └── autenticacion.spec.ts     # R-01..S-04  (11 tests)
│   ├── crm/
│   │   ├── contactos.spec.ts         # C-01..C-13  (13 tests)
│   │   ├── empresas.spec.ts          # E-01..E-10  (10 tests)
│   │   ├── oportunidades.spec.ts     # O-01..O-17  (14 tests)
│   │   ├── actividades.spec.ts       # A-01..A-13  (13 tests)
│   │   └── pipeline.spec.ts          # PL-01..PL-13 (11 tests)
│   ├── sales/
│   │   ├── cotizaciones.spec.ts      # CQ-01..CQ-17 (14 tests)
│   │   ├── pedidos.spec.ts           # P-01..P-19  (16 tests)
│   │   ├── flujo-venta.spec.ts       # FV-01..FV-08 (8 tests)
│   │   └── transportistas.spec.ts    # TR-01..TR-07 (7 tests)
│   ├── productos/
│   │   └── productos.spec.ts         # PR-01..PR-12 (12 tests)
│   ├── configuracion/
│   │   └── configuracion.spec.ts     # CF-01..CF-17 (15 tests)
│   ├── conversaciones/
│   │   └── inbox.spec.ts             # IN-01..IN-17 (17 tests)
│   └── sistema/
│       └── eventos.spec.ts           # EV-01..EV-14 (13 tests)
├── fixtures/
│   └── index.ts                      # Rutas de storageState por rol
└── setup/
    └── auth.setup.ts                 # Login de cada rol — corre antes de los tests
```

---

## Cómo funciona la autenticación

Antes de ejecutar cualquier test, Playwright corre `tests/setup/auth.setup.ts` que:

1. Abre el navegador e inicia sesión con cada rol
2. Guarda la sesión en archivos `.auth/<rol>.json`
3. Los tests cargan esas sesiones sin necesidad de hacer login en cada prueba

Esto ahorra tiempo y evita que los tests de login fallidos afecten a los demás módulos.

Los archivos `.auth/` están en `.gitignore` — se regeneran automáticamente cada vez que corres los tests.

---

## Tests de permisos por rol

Los tests que verifican acceso por rol usan `browser.newContext()` con el `storageState` del rol correspondiente. Ejemplos:

| Test | Rol usado | Qué verifica |
|------|-----------|--------------|
| `C-12` | SUPERVISOR | No ve botones de edición en contactos |
| `C-13` | INVITADO | Bloqueado al acceder a `/crm/contactos/nuevo` |
| `O-16` | EJECUTIVO_VENTAS | No puede acceder a `/crm/oportunidades` |
| `PL-11` | EJECUTIVO_VENTAS | No puede acceder al pipeline Kanban |
| `CF-16` | AGENTE_VENTAS | Bloqueado en `/configuracion` |

---

## Tests que requieren configuración adicional

Algunos tests documentan comportamientos que no se pueden verificar completamente desde el browser:

| Tests | Qué requieren |
|-------|--------------|
| `EV-11`, `EV-12` | Acceso a RabbitMQ Management UI (puerto 15672) |
| `EV-09` | Verificar bandeja de correo del usuario de registro |
| `EV-10` | Simular fallo transitorio de BD |
| `EV-14` | Verificación en IDE (error TypeScript en tiempo de diseño) |

Estos tests están marcados con `test.skip()` o con anotaciones explicativas y no bloquean la suite principal.

---

## Interpretar los resultados

```
✓  C-01 Ver lista de contactos                    (1.2s)
✓  C-04 Crear contacto con datos mínimos          (2.8s)
✗  C-10 Editar contacto                           (3.1s)
~  EV-10 Dead-letter queue                        (skipped)
```

| Símbolo | Significado |
|---------|-------------|
| `✓` | Test pasó — comportamiento correcto |
| `✗` | Test falló — revisar el reporte HTML para ver la captura y el error |
| `~` | Test saltado — requiere configuración adicional (ver sección anterior) |

---

## Solución de problemas frecuentes

**El setup de auth falla / no puede hacer login**
- Verificar que `BASE_URL` apunta a una instancia corriendo
- Verificar que los emails y contraseñas en `.env.test` son correctos para ese ambiente
- Verificar que los usuarios tienen el rol correcto asignado

**Tests de módulo fallan todos juntos**
- El setup de auth no se completó — revisar el paso de setup en el reporte
- El usuario `owner` no tiene acceso completo en el ambiente

**"Timeout exceeded" en varios tests**
- La aplicación está lenta — aumentar el timeout en `playwright.config.ts`:
  ```ts
  use: { actionTimeout: 15000, navigationTimeout: 30000 }
  ```

**Los selectores no encuentran elementos**
- La UI puede tener textos o roles ARIA diferentes al ambiente de desarrollo
- Usar el modo UI (`npm run test:e2e:ui`) para inspeccionar el DOM real y ajustar selectores

---

## Agregar un nuevo test

1. Localiza el archivo `.spec.ts` del módulo correspondiente en `tests/e2e/`
2. Agrega el caso dentro del `describe` apropiado siguiendo la convención del ID del MD:

```typescript
test('XX-00 Descripción del caso', async ({ page }) => {
  await page.goto('/ruta');
  // pasos del test
  await expect(page.locator('...')).toBeVisible();
});
```

3. Si el test necesita un rol específico, usa `browser.newContext()`:

```typescript
test('XX-00 Test con rol SUPERVISOR', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile.supervisor });
  const page = await ctx.newPage();
  // ... test
  await ctx.close();
});
```
