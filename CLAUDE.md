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

Detalle completo (identidad visual y tokens, generación de componentes primitivos, generación
de patrones compuestos): `.agents/skills/design-systems/`. Este skill reemplaza a los antiguos
`ui-component` y `ui-pattern` (fusionados para evitar solapamiento).

---

### `seo-audit`
Uso puntual, no en cada feature. Aplicar solo cuando:
- Se trabaja en páginas de marketing o públicas (landing page en `src/app/page.tsx`)
- Se solicita revisar o agregar metadata (`title`, `description`, Open Graph)
- Se pide optimizar Core Web Vitals o performance de carga
- Se necesita implementar `generateMetadata` en una ruta

Contexto: El CRM es una app privada (requiere auth), por lo que SEO aplica principalmente a la landing page y páginas de acceso público — no a las pantallas internas del CRM.

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

## Reglas generales de desarrollo

1. **Español en el dominio**: nombres de variables, funciones y comentarios del dominio de negocio van en español (ej: `obtenerContactos`, `crearOportunidad`, `etapa`, `valorPipeline`)
2. **TypeScript estricto**: no usar `any`; derivar tipos desde los esquemas Zod con `z.infer<>`
3. **Sin comentarios obvios**: solo comentar el *por qué*, no el *qué*
4. **Imports directos**: no usar barrel files (`index.ts`); importar directamente desde el archivo fuente
5. **No inventar tokens de diseño**: usar exclusivamente los tokens semánticos de Tailwind definidos en el proyecto
6. **Design tokens**: fuente de verdad en `src/app/globals.css`. Los colores intensos (purple/cyan/amber/orange/green/red) representan significado — etapas, estados, CTA — nunca superficies grandes. No hardcodear hex/rgb en componentes; usar el token semántico equivalente (`var(--card)`, `var(--text-primary)`, etc.)
7. **Nombres de eventos de dominio**: todo evento se nombra en pasado (`ContactoCreado`, no `CrearContacto`). Un único contrato compartido en `src/eventos/contratos/`, reutilizado por publicador y suscriptor — nunca DTOs duplicados. Todo contrato lleva `version: number`. Los nombres oficiales viven en `EventosSistema`/`ComandosSistema` (`src/eventos/catalogo`), nunca strings sueltos. Todo evento nuevo se documenta en `docs/eventos.md`

---

## Comandos útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run db:migrate   # Ejecutar migraciones Prisma
npm run db:seed      # Poblar base de datos con datos de prueba
npm run db:studio    # Abrir Prisma Studio
```

