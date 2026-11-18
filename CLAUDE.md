# Karia — Guía para Claude

## Descripción del proyecto

**Karia** es una aplicación web de CRM (Customer Relationship Management) y ventas construida con Next.js 16 App Router, TypeScript, Prisma ORM sobre PostgreSQL y shadcn/ui.

El sistema gestiona:
- **CRM**: contactos, empresas, oportunidades, actividades y pipeline Kanban
- **Ventas**: cotizaciones y pedidos
- **Productos**: catálogo de productos

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2 (App Router) |
| Lenguaje | TypeScript 5 |
| Base de datos | PostgreSQL + Prisma 7 |
| UI | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Estado del servidor | TanStack Query v5 |
| Formularios | React Hook Form + Zod v4 |
| Auth | NextAuth v5 |
| Drag & Drop | dnd-kit |
| Íconos | Lucide React |

---

## Estructura del proyecto

```
src/
├── app/                    # Next.js App Router (páginas y layouts)
│   ├── crm/               # Módulo CRM
│   │   ├── contactos/
│   │   ├── empresas/
│   │   ├── oportunidades/
│   │   ├── actividades/
│   │   └── pipeline/
│   ├── sales/             # Módulo Ventas
│   │   ├── cotizaciones/
│   │   └── pedidos/
│   └── productos/         # Módulo Productos
├── components/
│   └── ui/                # Primitivos shadcn/ui (Button, Card, Input, etc.)
├── crm/                   # Lógica de dominio CRM
│   ├── [entidad]/
│   │   ├── actions.ts     # Server Actions
│   │   ├── queries.ts     # Queries Prisma
│   │   ├── schema.ts      # Esquemas Zod
│   │   ├── types.ts       # Tipos TypeScript
│   │   └── components/    # Componentes del módulo
├── sales/                 # Lógica de dominio Ventas
└── shared/
    └── db/                # Instancia Prisma compartida
prisma/
├── schema.prisma
└── seed.ts
```

---

## Convenciones del proyecto

### Componentes
- **Server Components por defecto** — usar `'use client'` solo cuando se necesiten hooks, eventos o estado local
- Los page components (`page.tsx`) son Server Components que hacen fetch directo con Prisma
- Los formularios (`form-*.tsx`) son Client Components
- Las listas con filtros interactivos son Client Components

### Server Actions
- Viven en `src/[dominio]/[entidad]/actions.ts`
- Marcadas con `'use server'`
- Validan con Zod antes de escribir en base de datos
- Llaman a `revalidatePath` tras mutaciones

### Queries
- Viven en `src/[dominio]/[entidad]/queries.ts`
- Son funciones async que usan la instancia compartida de Prisma en `src/shared/db/prisma`
- Se llaman directamente desde Server Components o Server Actions

### Formularios
- React Hook Form + `@hookform/resolvers/zod`
- El esquema Zod vive en `schema.ts`, separado del componente
- Se usan los componentes `<Form>`, `<FormField>`, `<FormItem>` de `src/components/ui/form.tsx`

### Estilos
- Tailwind CSS v4 con tokens semánticos (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`)
- `cn()` de `src/lib/utils.ts` para merge de clases
- No usar valores arbitrarios de Tailwind si existe un token semántico equivalente

---

## Skills disponibles — cuándo aplicarlos

### `react-best-practices`
Aplicar **siempre** al:
- Crear o modificar componentes React (`.tsx`)
- Implementar fetch de datos en el cliente (TanStack Query)
- Revisar re-renders, memoización o performance
- Detectar waterfalls de datos o bundle size elevado

Prioridades clave para este proyecto:
1. `async-parallel` — usar `Promise.all` en Server Components (ya aplicado en `crm/page.tsx`)
2. `bundle-dynamic-imports` — para componentes pesados como el pipeline Kanban
3. `rerender-memo` — en listas largas de contactos u oportunidades
4. `async-suspense-boundaries` — wrappear secciones con `<Suspense>` y skeleton

---

### `nextjs-best-practices`
Aplicar al:
- Decidir si un componente debe ser Server o Client
- Trabajar con `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Implementar Server Actions o Route Handlers
- Configurar metadata (`generateMetadata`) en páginas públicas
- Decidir estrategia de caché (`revalidate`, `no-store`, `revalidatePath`)

Reglas clave para este proyecto:
- Los pages que leen datos de Prisma son Server Components (`export const dynamic = 'force-dynamic'` cuando los datos cambian frecuentemente)
- Cada mutación en un Server Action debe llamar `revalidatePath` con la ruta afectada
- Usar `loading.tsx` o `<Suspense>` con skeleton en todas las páginas con fetch

---

### `design-systems`
Aplicar al:
- Crear un nuevo componente primitivo en `src/components/ui/`, o extender uno de shadcn/ui existente
- Crear una sección compuesta que aparece en múltiples páginas (lista con filtros, grid de cards KPI, tabla de datos con acciones, form section)
- Revisar o ajustar dark mode / light mode, o cuando una pantalla se vea básica, plana o inconsistente
- Evitar copiar markup idéntico entre módulos CRM y Sales

Reglas para este proyecto:
- Inspeccionar primero `src/components/ui/` — no crear duplicados
- Usar tokens semánticos de Tailwind v4: `bg-card`, `text-foreground`, `border-border` (fuente de verdad: `src/app/globals.css`)
- Pasar `className` siempre via `cn()` para permitir override
- Usar `data-slot` para identificación del componente
- Patrones ya existentes a reutilizar: cards KPI con skeleton (`crm/page.tsx`), tablas de lista con link y badge (`lista-contactos.tsx`, `lista-empresas.tsx`), forms con `<Form>` + `<FormField>` (`form-contacto.tsx`, `form-empresa.tsx`)
- Si el componente ya cumple la identidad visual del proyecto, dejarlo igual — no rediseñar por rediseñar
- **`<Select>` (`src/components/ui/select.tsx`)**: envuelve `@base-ui/react/select`
  (no Radix). Si el `value` de las `<SelectItem>` no es idéntico a su etiqueta
  visible, el `<Select>` raíz DEBE recibir la prop `items` (mapa `valor →
  etiqueta`, derivado del mismo arreglo que alimenta las `<SelectItem>`) — si
  no, el trigger muestra el `value` crudo en vez de la etiqueta hasta que el
  usuario abre el popup una vez. Ver `docs/selects.md` para el detalle y el
  checklist antes de tocar o crear cualquier `<Select>`.

- **Mascota de Karia**: usar `<KariaAvatar>` (`src/asistente/karia/karia-avatar.tsx`)
  y, para el flotante, `usarAsistenteKaria()`; nunca un `<img>` del sprite ni un
  GIF. Ver `docs/asistente-karia.md`.

Detalle completo (identidad visual y tokens, generación de componentes primitivos, generación
de patrones compuestos): `.agents/skills/design-systems/`. Este skill reemplaza a los antiguos
`ui-component` y `ui-pattern` (fusionados para evitar solapamiento).

---

### `readme`
Uso puntual, no en el desarrollo del día a día. Aplicar solo cuando:
- Se pide generar o actualizar el `README.md`
- Se solicita "documenta el proyecto" o "escribe la documentación"

El README debe cubrir: stack, prerequisites (`Node 20+`, `PostgreSQL`, variables de entorno), comandos (`npm run dev`, `npm run db:migrate`, `npm run db:seed`), estructura de directorios y guía de despliegue.

---

### `nodejs-best-practices`
Aplicar cuando:
- Se trabaja en Server Actions (`actions.ts`) o Route Handlers
- Se diseña manejo de errores en el servidor
- Se implementan patrones async (elegir entre `async/await`, `Promise.all`, `Promise.allSettled`)
- Se configura validación con Zod en el boundary del servidor
- Se discute arquitectura de capas (Controller → Service → Repository)

Reglas clave para este proyecto:
- Validar con Zod **siempre** al inicio de cada Server Action antes de tocar Prisma
- Nunca concatenar strings para construir queries — Prisma ya parametriza
- Usar `Promise.all` para queries independientes en paralelo (patrón ya establecido en `crm/page.tsx`)
- Los errores de servidor no deben exponer detalles internos al cliente

---

## Spec Kit — Feature vs Hotfix

Todo trabajo no trivial pasa por Spec Kit (`.specify/`, comandos `/speckit-*`). Hay dos flujos, documentados con el detalle completo (plantillas, tabla comparativa, árbol de decisión, ejemplos reales) en **`docs/SPEC-KIT-WORKFLOWS.md`** — leerlo antes de correr `/speckit-specify` si hay dudas de cuál aplica:

- **Feature** (funcionalidad nueva, ej. `005-facebook-messenger-integracion`): ciclo completo obligatorio — specify → plan → tasks → implement, con `research.md`/`data-model.md`/`quickstart.md`/`tasks.md` por historia de usuario (P1/P2/P3).
- **Hotfix** (algo que Karia ya hace y no funciona bien, ej. `004`, `006`, `008` — nombre corto con prefijo `fix-`): mismo ciclo pero acotado — el spec MUST empezar con una sección **"Diagnóstico previo"** (causa raíz confirmada en código antes de definir alcance), el plan es liviano, y `tasks.md` puede ser mínimo (1-2 tareas) si el fix es chico. Todo Hotfix MUST incluir un requisito explícito de "no alterar el comportamiento existente" de lo que ya funcionaba.

Regla rápida: si el pedido describe un síntoma sobre algo que ya se prometía/mostraba funcionando, es Hotfix; si es una capacidad que Karia nunca tuvo, es Feature — aunque "parezca" una corrección (ver el caso `007` en el documento).

## Reglas generales de desarrollo

1. **Español en el dominio**: nombres de variables, funciones y comentarios del dominio de negocio van en español (ej: `obtenerContactos`, `crearOportunidad`, `etapa`, `valorPipeline`)
2. **TypeScript estricto**: no usar `any`; derivar tipos desde los esquemas Zod con `z.infer<>`
3. **Sin comentarios obvios**: solo comentar el *por qué*, no el *qué*
4. **Imports directos**: no usar barrel files (`index.ts`); importar directamente desde el archivo fuente
5. **No inventar tokens de diseño**: usar exclusivamente los tokens semánticos de Tailwind definidos en el proyecto
6. **Design tokens**: fuente de verdad en `src/app/globals.css`. Los colores intensos (purple/cyan/amber/orange/green/red) representan significado — etapas, estados, CTA — nunca superficies grandes. No hardcodear hex/rgb en componentes; usar el token semántico equivalente (`var(--card)`, `var(--text-primary)`, etc.)
7. **Fechas y zonas horarias**: todo timestamp interno se almacena, transmite y
   procesa en **UTC**. Hay **dos zonas distintas** y confundirlas es el error
   clásico:
   - `obtenerZonaNegocio(instanciaId)` (`src/shared/fechas/negocio.ts`) — sale
     solo de `ConfiguracionEmpresa.zonaHoraria`. Única fuente válida para rangos
     de día, filtros, KPIs, cuotas y reglas. **Si un valor llega a un `where` de
     Prisma, viene de acá.** Disponible también en el worker.
   - `obtenerPreferenciasFechaEfectivas(...)` (`src/shared/fechas/presentacion.ts`)
     — usuario → empresa → navegador (`x-time-zone`) → UTC. Solo para formatear
     en pantalla; nunca entra en una query.

   Filtros: siempre rangos semiabiertos `{ gte, lt }` sobre la columna cruda
   (helpers en `src/shared/fechas/rangos.ts`). Nunca `lte` sobre un límite de
   día, nunca `AT TIME ZONE`/`DATE_TRUNC` sobre la columna. Presentación: usar
   `<FechaHora>` o `formatearFecha`, nunca `format()` de date-fns ni
   `toLocaleDateString()`. Entradas: `<InputFecha>` / `<InputFechaHora>`, nunca
   `.toISOString().slice(0,10)`. Identificadores IANA siempre, nunca `UTC-5`.
   Detalle completo, tabla de trampas y justificación de por qué no se migró a
   `@db.Date`: **`docs/fechas-y-zonas-horarias.md`** — leerlo antes de tocar
   cualquier fecha.

   **Pedido tiene tres ejes de fecha y cada KPI usa el suyo** (038):
   `fechaPedido` (la lista y "Total pedidos"), `fechaEntrega`
   ("Pendientes"/"Expirados") y `fechaVenta` ("Total ventas" y
   "Total ventas · mes actual"). Equivocarse de eje no rompe nada visible:
   solo da un número mal.

   `fechaVenta` **se sella una sola vez**: la primera vez que el pedido entra
   a una etapa con `cuentaComoVenta`. Si hay varias marcadas, manda la
   primera a la que llegó; avanzar después a otra que también cuenta NO mueve
   la fecha, y volver a una que no cuenta tampoco la borra. En el `data` de
   Prisma, "no tocar" es `undefined` — nunca `null`, que la borraría.

   Se escribe **siempre en el mismo `update`/`create` que
   `flujoVentaEtapaId`**, en la misma transacción y con el mismo objeto
   `Date` que la fila de `PedidoHistorialEtapa`. Son cuatro sitios: creación
   manual del pedido, conversión desde cotización, motor de etapas y ejecutor
   de disparadores. **Si agregás un quinto, tiene que sellarla también** — un
   pedido sin esa fecha queda fuera de todo total filtrado por rango, sin
   ningún error.

   `Pedido.fechaExpiracion` ya no existe: un pedido no expira. No confundir
   con `Cotizacion.fechaVencimiento` ni con `EntregaDigitalPedido.fechaExpiracion`.
8. **Documentación del agente IA**: los archivos que el negocio sube para su
   agente se indexan en un **vector store de OpenAI por instancia**
   (`Instancia.vectorStoreDocumentacionId`, creado solo la primera vez que la
   cuenta sube algo) y se consultan con la herramienta
   `buscar_en_documentacion`. El aislamiento entre cuentas es **físico** —el
   índice de un comercio no contiene bytes de otro—; dentro de la cuenta, cada
   documento pertenece a un agente y eso sí es lógico: identidad
   `instanciaId_agenteId_documentoId` en el nombre y los atributos del archivo,
   filtro obligatorio en cada búsqueda, y verificación a posteriori de cada
   fragmento devuelto. Todo eso sale de `src/ai/documentacion/aislamiento.ts` y
   de ningún otro lado: esas funciones no aceptan parámetros que permitan
   omitir la identidad, y es a propósito. La credencial es de Karia por entorno
   (`OPENAI_DOCUMENTACION_API_KEY`), no el `ProveedorIA` del tenant: así
   funciona también para agentes sobre Anthropic o DeepSeek.
   Los identificadores de OpenAI (`vectorStoreId`, `openaiFileId`,
   `vectorStoreFileId`) **nunca** salen al cliente. Cada búsqueda se registra en
   `UsoIA` con `tarea: BUSQUEDA_DOCUMENTAL` y los tokens reales del `usage` del
   proveedor; la indexación no registra tokens porque OpenAI la factura por
   storage. Leer **`docs/documentacion-agente-aislamiento.md`** antes de tocar
   `src/ai/documentacion/`.
9. **Canal de correo vs. correo transaccional**: son dos sistemas distintos y
   confundirlos es el error esperable. `src/integraciones/email/` es el **canal
   de atención**: el buzón IMAP/SMTP del comercio, con credenciales propias
   cifradas en `CuentaCanal.configuracion`, leído **solo desde el worker** (si
   la app Next.js leyera, cada réplica duplicaría la lectura). `src/lib/email/`
   (Resend) manda los correos que **Karia** le escribe al usuario del CRM
   —bienvenida, notificaciones—: otra credencial, otro dueño, no se tocan entre
   sí.

   Tres reglas del canal que no se negocian:
   - **El HTML entrante solo se muestra limpio, en un iframe sandbox sin
     scripts ni mismo origen y con CSP restrictiva; nunca dentro de la página
     de Karia** (035). Tres capas independientes, y ninguna se relaja para que
     un correo "se vea mejor":
     1. *Limpieza*: `sanitize-html` con lista blanca
        (`mensaje/html/politica.ts`) al recibir, en el worker; solo se guarda
        el HTML limpio, en `MensajeCorreo` — el original no se guarda nunca. Al
        servir se vuelve a limpiar con la misma política.
     2. *Aislamiento*: `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">`
        (`PERMISOS_SANDBOX` en `vista/documento.ts`). Prohibidos
        `allow-scripts`, `allow-same-origin`, `allow-forms` y
        `allow-top-navigation*`, y prohibido `srcdoc` o
        `dangerouslySetInnerHTML` con contenido de un correo. La ruta de vista
        manda CSP con `script-src 'none'`, `connect-src 'none'` y `sandbox`.
     3. *Autorización*: el iframe no envía la cookie de sesión, así que vista,
        imágenes `cid:` y proxy usan un token HMAC de 15 min
        (`CORREO_VISTA_SECRETO`), emitido por una ruta con sesión; cada ruta
        vuelve a verificar el comercio contra la base y responde 404 ante
        cualquier discrepancia.

     Las imágenes externas quedan bloqueadas por defecto y solo se cargan por
     el proxy SSRF-seguro (`vista/proxy-imagen.ts`: DNS validado y fijado,
     `net.BlockList`, redirecciones revalidadas, solo raster re-codificado).
     El TEXTO del correo sigue siendo la fuente para IA, búsqueda, lista y
     Workflows. Detalle: `specs/035-correo-html-seguro/`.
   - **Auto-respuestas, rebotes y correos del propio buzón se descartan antes
     de crear nada** (`mensaje/filtros.ts`). Sin eso, un aviso de vacaciones
     crea oportunidad, dispara a la IA, la IA responde y el aviso vuelve a
     dispararse.
   - **El bloqueo por aprobación de remitente corta en TRES lugares**:
     `conversaciones/envio.ts`, `suscriptores/ai/orquestar-ia.suscriptor.ts` y
     `workflows/motor/disparo.ts`. Tocar uno solo deja un agujero por el que la
     IA o un Workflow responden un correo no aprobado. La fuente de verdad es
     `ContactoIdentificadorCanal.aprobadoEn`; las banderas de `Conversacion` y
     `Oportunidad` son derivadas y se escriben en la misma transacción, en
     `aprobacion/actions.ts`.

   Detalle completo en `specs/034-canal-correo-electronico/`.
10. **"Cuenta como Venta" se deriva, nunca se persiste** (038): qué pedidos
    suman en "Total ventas" sale de leer `FlujoVentaEtapa.cuentaComoVenta` en
    **cada consulta** (`construirCondicionVenta` en
    `src/sales/pedidos/condicion-venta.ts`). Esa es la razón por la que marcar
    o desmarcar una etapa cambia los totales en el siguiente render, sin
    recálculo ni migración. Copiar el flag al `Pedido` "para optimizar"
    destruye esa garantía entera.

    El caso que una refactorización rompe sin que nadie lo note: con flujo
    dinámico y ninguna etapa marcada, la condición es `{ in: [] }` y los
    totales dan 0. "Simplificarlo" a `{}` hace que vuelvan a sumar **todos**
    los pedidos — el problema exacto que 038 corrige — y los tests de las
    demás etapas siguen pasando. Hay un test dedicado a ese caso; no borrarlo.

    Mismo criterio que Preparación de Pedidos (`src/sales/preparacion/utils/entrada.ts:11`).

    **La fecha es el caso contrario y conviene no mezclarlos**: `fechaVenta`
    sí se materializa y sí queda atada a la configuración vigente al sellarse.
    Marcar más adelante una etapa anterior del flujo no reescribe los pedidos
    ya sellados. Es una diferencia deliberada, no una inconsistencia.

    Detalle: `specs/038-cuenta-como-venta/`.

11. **Nombres de eventos de dominio**: todo evento se nombra en pasado (`ContactoCreado`, no `CrearContacto`). Un único contrato compartido en `src/eventos/contratos/`, reutilizado por publicador y suscriptor — nunca DTOs duplicados. Todo contrato lleva `version: number`. Los nombres oficiales viven en `EventosSistema`/`ComandosSistema` (`src/eventos/catalogo`), nunca strings sueltos. Todo evento nuevo se documenta en `docs/eventos.md`
12. **Segmentación de Contactos** (041): Cliente, Interesado, Lead y el
    estado de seguimiento se **derivan en cada consulta** desde
    `src/crm/contactos/segmentacion/condiciones.ts` — la única definición, que
    usan los indicadores, los filtros, la paginación por prioridad y cada fila.
    Cliente reutiliza `construirCondicionVenta`; nunca se guarda en el contacto.
    Las condiciones guardan cada fecha nulable con su `not: null` porque bajo
    `NOT` un NULL descarta la fila de ambos lados; hay un test de matriz que lo
    vigila.

    `Contacto.ultimaInteraccionEn` y `esperandoRespuestaDesde` solo se escriben
    desde `src/crm/contactos/interaccion.ts`. Cuentan como interacción los
    mensajes del contacto, los de una persona, las actividades y los pedidos;
    **no** los envíos automáticos de la IA o de un Workflow (que sí cierran la
    espera de respuesta).

    Todo envío por `enviarMensajeInterno` declara `autor: "PERSONA" | "IA" |
    "WORKFLOW"` (obligatorio). "No contactar" corta los envíos automáticos ahí
    mismo, más dos cortes tempranos en `orquestar-ia.suscriptor.ts` y
    `workflows/motor/disparo.ts`; a una persona solo se le avisa. El interés y
    "No contactar" se escriben únicamente por `src/crm/contactos/clasificacion.ts`,
    que rechaza pisar un interés fijado a mano y que un proceso automático
    vuelva a habilitar un contacto. Detalle: `specs/041-contactos-segmentacion-comercial/`.

---

## Comandos útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run db:migrate   # Ejecutar migraciones Prisma
npm run db:seed      # Poblar base de datos con datos de prueba
npm run db:studio    # Abrir Prisma Studio
```

