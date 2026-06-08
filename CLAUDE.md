# Vento — Guía para Claude

## Descripción del proyecto

**Vento** es una aplicación web de CRM (Customer Relationship Management) y ventas construida con Next.js 16 App Router, TypeScript, Prisma ORM sobre PostgreSQL y shadcn/ui.

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

### `ui-component`
Aplicar al:
- Crear un nuevo componente primitivo en `src/components/ui/`
- Extender o modificar un componente shadcn/ui existente
- Necesitar un componente reutilizable de bajo nivel (badge, input, button variante)

Reglas para este proyecto:
- Inspeccionar primero `src/components/ui/` — no crear duplicados
- Usar tokens semánticos de Tailwind v4: `bg-card`, `text-foreground`, `border-border`
- Pasar `className` siempre via `cn()` para permitir override
- Usar `data-slot` para identificación del componente

---

### `ui-pattern`
Aplicar al:
- Crear una sección compuesta que aparece en múltiples páginas (lista con filtros, grid de cards KPI, tabla de datos con acciones)
- Necesitar un patrón de layout reutilizable (form section, stat grid, detail card, filter bar)
- Evitar copiar markup idéntico entre módulos CRM y Sales

Patrones ya existentes en el proyecto a reutilizar:
- Cards KPI con skeleton (`crm/page.tsx`)
- Tablas de lista con link y badge (`lista-contactos.tsx`, `lista-empresas.tsx`)
- Forms con `<Form>` + `<FormField>` (`form-contacto.tsx`, `form-empresa.tsx`)

---

### `seo-audit`
Aplicar cuando:
- Se trabaja en páginas de marketing o públicas (landing page en `src/app/page.tsx`)
- Se solicita revisar o agregar metadata (`title`, `description`, Open Graph)
- Se pide optimizar Core Web Vitals o performance de carga
- Se necesita implementar `generateMetadata` en una ruta

Contexto: El CRM es una app privada (requiere auth), por lo que SEO aplica principalmente a la landing page y páginas de acceso público.

---

### `readme`
Aplicar cuando:
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

### `prompt-engineering-patterns`
Aplicar **siempre** cuando:
- Se pide generar, mejorar o diseñar un prompt para un LLM
- Se pide crear un system prompt para un agente o asistente
- Se pide optimizar instrucciones para Claude u otro modelo
- Se diseña una plantilla de prompt con variables o few-shot examples

Técnicas a aplicar por defecto:
- Jerarquía `[System Context] → [Task Instruction] → [Examples] → [Input Data] → [Output Format]`
- Progressive Disclosure: empezar simple, añadir complejidad solo si es necesario
- Incluir formato de salida explícito cuando el output debe ser estructurado

---

## Reglas generales de desarrollo

1. **Español en el dominio**: nombres de variables, funciones y comentarios del dominio de negocio van en español (ej: `obtenerContactos`, `crearOportunidad`, `etapa`, `valorPipeline`)
2. **TypeScript estricto**: no usar `any`; derivar tipos desde los esquemas Zod con `z.infer<>`
3. **Sin comentarios obvios**: solo comentar el *por qué*, no el *qué*
4. **Imports directos**: no usar barrel files (`index.ts`); importar directamente desde el archivo fuente
5. **No inventar tokens de diseño**: usar exclusivamente los tokens semánticos de Tailwind definidos en el proyecto

---

## Comandos útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run db:migrate   # Ejecutar migraciones Prisma
npm run db:seed      # Poblar base de datos con datos de prueba
npm run db:studio    # Abrir Prisma Studio
```

---
---

## `premium-olive-ui`

Aplicar cuando:
- Se diseñen dashboards, menús, cards, layouts o pantallas principales
- La UI se vea básica, plana o poco moderna
- Se pida mejorar dark mode, glassmorphism o minimalismo visual

Objetivo:
Crear una interfaz moderna tipo SaaS premium usando:
- Dark Mode elegante
- Glassmorfismo sutil
- Minimalismo inteligente
- Tonalidades verde oliva/lime/emerald
- Mejor jerarquía visual y espaciado

Reglas visuales obligatorias:
1. Evitar fondos completamente negros planos.
2. Usar fondos con degradados oscuros:
   - `bg-[radial-gradient(...)]`
   - `from-stone-950`
   - `via-neutral-950`
   - `to-black`
3. Las cards deben usar glassmorphism:
   - `bg-white/5`
   - `backdrop-blur-xl`
   - `border border-white/10`
   - `shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]`
4. Los botones deben verse modernos:
   - `rounded-xl`
   - `bg-lime-500/90`
   - `text-stone-950`
   - `hover:bg-lime-400`
   - `shadow-lg`
   - `transition-all`
   - `hover:scale-[1.02]`
5. El sidebar debe tener:
   - fondo translúcido `bg-stone-950/80`
   - `backdrop-blur-xl`
   - separadores suaves `border-white/10`
   - items con hover visible
   - item activo con fondo oliva/lime translúcido
6. Los textos deben tener buena jerarquía:
   - títulos `text-2xl font-semibold tracking-tight`
   - subtítulos `text-sm text-muted-foreground`
   - labels en mayúscula ligera `uppercase tracking-wide text-xs`
7. Evitar demasiados bordes duros.
8. Usar iconos con contenedores suaves.
9. Usar animaciones sutiles, nunca exageradas.
10. Mantener siempre buena legibilidad.

Colores recomendados:
- Fondo principal: `stone-950`, `neutral-950`, `zinc-950`
- Primario: `lime-400`, `lime-500`, `green-500`, `emerald-400`
- Superficies: `white/5`, `white/10`, `stone-900/60`
- Bordes: `white/10`, `lime-400/20`
- Texto principal: `text-stone-50`
- Texto secundario: `text-stone-400`

Errores a corregir:
- Menús muy planos
- Botones básicos sin jerarquía
- Cards demasiado oscuras sin contraste
- Falta de hover/active state
- Espaciado comprimido
- Fuentes o tamaños inconsistentes
- Íconos sin tratamiento visual

Regla de aplicación:
- Si el componente ya cumple este estilo premium, dejarlo igual.
- Si el componente se ve básico, plano o inconsistente, aplicar esta política visual.
- No cambiar lógica de negocio.
- No cambiar nombres de rutas, hooks, actions, queries o modelos.
