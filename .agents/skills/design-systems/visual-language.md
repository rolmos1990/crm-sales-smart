# Identidad visual — Karia CRM

## Fuente de verdad

Los tokens de color viven como custom properties CSS en `src/app/globals.css` (bloques light y
dark, mapeados a alias Tailwind v4 en el bloque `@theme`). Este documento describe la
**filosofía** del sistema, no los valores hex — esos se consultan siempre en `globals.css`
para evitar que la documentación quede desincronizada del código real.

## Filosofía

- **Dark mode**: familia charcoal/slate con un ligero matiz azul. Nunca negro puro
  (`#000000`) como superficie. Jerarquía de superficies sutil y progresiva:
  `background → sidebar → containers/columns → cards → elevated/hover`.
- **Light mode**: blancos ligeramente fríos y grises suaves. Nunca blanco puro (`#FFFFFF`)
  combinado con negro puro y colores muy saturados. Misma jerarquía semántica que dark mode,
  mismos nombres de token en ambos temas (equivalencia light ↔ dark).
- **Verde de marca ("Karia Green")**: color primario y de CTA. Versión madura y controlada —
  nunca fluorescente, nunca con glow o box-shadow de color.
- **Los colores intensos representan significado, no superficies**: purple/cyan/amber/orange/
  green/red se usan para etapas del pipeline, estados, badges, CTA e indicadores — nunca para
  rellenar grandes superficies. Las superficies grandes (background, sidebar, cards, columnas)
  permanecen siempre neutrales.
- **Bordes suaves**: evitar bordes blancos/negros translúcidos demasiado marcados o líneas
  tipo neón. Preferir separación por diferencia de superficie + borde sutil antes que sombras
  grandes.
- **Tipografía con jerarquía clara**: títulos `text-2xl font-semibold tracking-tight`,
  subtítulos `text-sm text-muted-foreground`, labels en mayúscula ligera
  `uppercase tracking-wide text-xs`.
- **Cards**: `rounded-xl`/`rounded-2xl`, sombras suaves y contenidas (`shadow-sm`/`shadow-md`),
  buen espaciado (`p-4`/`p-6`, `gap-4`/`gap-6`). Sin glassmorphism ni degradados salvo que el
  usuario lo pida explícitamente para una pantalla puntual.

## Reglas para Claude Code

- Antes de tocar estilos, localizar el sistema global de tokens (`src/app/globals.css`) y
  mapear cualquier valor nuevo a un token semántico existente antes de inventar uno.
- Respetar siempre la estructura y arquitectura existente del proyecto.
- No duplicar componentes si ya existe uno reutilizable en `src/components/ui/`.
- No cambiar lógica de negocio, rutas, hooks o Server Actions solo por una mejora visual.
- Si un componente ya cumple con esta identidad visual, dejarlo igual — no rediseñar por rediseñar.
- Buscar explícitamente colores hardcodeados (`bg-black`, `bg-white`, hex/rgb directos) que
  rompan el soporte de light/dark antes de darlos por terminados.
