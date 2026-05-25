# Design System - Olive UI

## Identidad visual

El sistema debe usar una estética moderna, limpia, elegante y fácil de entender.

La paleta principal debe estar basada en tonalidades de verde oliva, combinadas con colores neutros suaves.

## Colores principales

### Light Mode

- Background: `bg-stone-50`
- Surface/Card: `bg-white`
- Border: `border-stone-200`
- Text Primary: `text-stone-900`
- Text Secondary: `text-stone-500`
- Primary: `bg-olive-600` o `bg-lime-700`
- Primary Hover: `hover:bg-olive-700`
- Accent: `bg-emerald-100 text-emerald-800`

### Dark Mode

- Background: `dark:bg-stone-950`
- Surface/Card: `dark:bg-stone-900`
- Border: `dark:border-stone-800`
- Text Primary: `dark:text-stone-50`
- Text Secondary: `dark:text-stone-400`
- Primary: `dark:bg-lime-600`
- Primary Hover: `dark:hover:bg-lime-500`
- Accent: `dark:bg-emerald-950 dark:text-emerald-300`

## Estilo visual

- Usar `rounded-2xl`
- Usar sombras suaves: `shadow-sm`, `shadow-md`
- Espaciado cómodo: `p-4`, `p-6`, `gap-4`, `gap-6`
- Interfaces limpias, no saturadas
- Usar cards para separar información
- Usar iconos de `lucide-react`
- Usar animaciones sutiles con `framer-motion`

## Theme

El sistema debe soportar:

- Light mode
- Dark mode
- Selección manual del usuario
- Persistencia en navegador usando `localStorage`
- Preferencia inicial basada en el sistema operativo si no existe selección guardada

## Reglas para Claude Code

Claude debe respetar siempre:

- La estructura actual del proyecto
- La arquitectura existente
- Los componentes existentes
- No modificar lógica de negocio si solo se solicita mejora visual
- No duplicar componentes si ya existe uno reutilizable
- No cambiar rutas, servicios, hooks o llamadas API sin permiso
- Crear componentes visuales reutilizables cuando una pantalla crezca demasiado