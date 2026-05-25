# Skill: Olive UI Designer

## Objetivo

Mejorar interfaces hechas en Next.js manteniendo la estructura del proyecto y aplicando un diseño moderno basado en tonalidades verde oliva, con soporte para dark mode y light mode.

## Stack esperado

- Next.js
- Tailwind CSS
- shadcn/ui si está disponible
- lucide-react
- framer-motion
- next-themes para manejo de tema

## Reglas obligatorias

1. No cambiar lógica de negocio.
2. No cambiar servicios, endpoints, hooks o modelos sin autorización.
3. Respetar la estructura actual del proyecto.
4. Reutilizar componentes existentes antes de crear nuevos.
5. Si se crean componentes nuevos, ubicarlos en carpetas coherentes:
   - `src/components/ui`
   - `src/components/shared`
   - `src/components/layout`
   - `src/providers`
6. Mantener código simple, limpio y mantenible.
7. Aplicar diseño responsive.
8. Agregar estados visuales cuando aplique:
   - loading
   - empty state
   - error state
   - disabled state

## Paleta visual

Usar tonalidades:

- stone
- zinc
- lime
- emerald
- olive-like usando combinaciones de `lime-700`, `green-700`, `emerald-700`, `stone`

## Light Mode

Usar:

- `bg-stone-50`
- `bg-white`
- `text-stone-900`
- `text-stone-500`
- `border-stone-200`
- `bg-lime-700`
- `hover:bg-lime-800`

## Dark Mode

Usar:

- `dark:bg-stone-950`
- `dark:bg-stone-900`
- `dark:text-stone-50`
- `dark:text-stone-400`
- `dark:border-stone-800`
- `dark:bg-lime-600`
- `dark:hover:bg-lime-500`

## Componentes recomendados

Crear o reutilizar:

- `ThemeProvider`
- `ThemeToggle`
- `PageHeader`
- `StatCard`
- `EmptyState`
- `DataCard`
- `SectionCard`
- `ActionToolbar`

## Prompt interno de ejecución

Cuando el usuario pida mejorar una pantalla, hacer esto:

1. Revisar la estructura actual del archivo.
2. Identificar si ya existen componentes reutilizables.
3. Mejorar solo la parte visual.
4. Aplicar clases Tailwind compatibles con light/dark mode.
5. Mantener nombres, props y lógica existente.
6. Separar componentes solo si mejora la claridad.
7. Evitar rediseños exagerados que rompan la experiencia actual.

## Resultado esperado

Una interfaz moderna, limpia, elegante, legible, responsive y con soporte completo para light/dark mode usando persistencia en navegador.