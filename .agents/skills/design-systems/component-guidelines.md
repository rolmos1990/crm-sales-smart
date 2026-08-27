# Component Guidelines

Cómo generar un componente primitivo nuevo (o extender uno existente) respetando el sistema de
diseño del proyecto en vez de improvisar markup y estilos ad hoc.

Adaptado de [StyleSeed](https://github.com/bitjaru/styleseed) (skill `ui-component`) a las
convenciones reales de este proyecto.

## Cuándo usar

- Se necesita un primitivo de UI nuevo o compuesto de bajo nivel (badge, input, variante de botón)
- El componente debe ser reutilizable, tipado y basado en tokens de diseño
- Existe el riesgo de que se improvisen espaciados, colores o patrones de interacción

## Cómo hacerlo

### 1. Leer el contexto de diseño local

Antes de generar código, inspeccionar la fuente de verdad del proyecto:
- `CLAUDE.md` para convenciones generales
- `src/app/globals.css` para los tokens semánticos vigentes
- al menos un componente representativo de `src/components/ui/`

Si ya existe un ejemplo local mejor que una plantilla genérica, seguir el código local.

### 2. Elegir el lugar correcto

- `src/components/ui/` — primitivos y building blocks de bajo nivel (inspeccionar primero, no crear duplicados)
- El módulo de dominio correspondiente (`src/crm/[entidad]/components/`, `src/sales/[entidad]/components/`, etc.) — componentes específicos de una feature

No crear un primitivo nuevo si uno existente puede extenderse de forma segura.

### 3. Reglas estructurales

- Function declaration en vez de componente `const`, salvo que el archivo ya use el otro estilo
- `React.ComponentProps<>` (o equivalente) para tipar props nativas
- Soporte de `className` pass-through
- `cn()` de `src/lib/utils.ts` para merge de clases — siempre
- `data-slot` para identificación del componente
- CVA (o equivalente) solo cuando de verdad hay variantes

### 4. Usar solo tokens semánticos

No hardcodear valores visuales si el design system ya tiene un token para eso.

Ejemplos preferidos: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`,
`shadow-[var(--shadow-card)]` — ver `visual-language.md` para la filosofía completa y
`src/app/globals.css` para los valores vigentes.

### 5. Accesibilidad de base

- Área táctil mínima 44x44px en elementos interactivos
- Foco de teclado visible
- Pasar `aria-*` cuando corresponda
- Respetar `prefers-reduced-motion` para animaciones no esenciales

### `<Select>` — caso especial del proyecto

`src/components/ui/select.tsx` envuelve `@base-ui/react/select` (no Radix). Si el `value` de
las `<SelectItem>` no es idéntico a su etiqueta visible, el `<Select>` raíz DEBE recibir la
prop `items` (mapa `valor → etiqueta`, derivado del mismo arreglo que alimenta las
`<SelectItem>`) — si no, el trigger muestra el `value` crudo en vez de la etiqueta hasta que
el usuario abre el popup una vez. Ver `docs/selects.md` para el checklist completo antes de
tocar o crear cualquier `<Select>`.

## Output esperado

1. El componente generado
2. La ruta destino
3. Imports o dependencias necesarias
4. Notas sobre variantes, tokens o trabajo de integración pendiente

## Buenas prácticas

- Componer a partir de primitivos existentes antes de inventar uno nuevo
- Mantener la API del componente pequeña y predecible
- Preferir clases de layout semánticas sobre valores arbitrarios
- Exportar componentes con nombre, consistente con el resto del proyecto

## Limitations
- Usar este documento solo cuando la tarea calza con el alcance descrito arriba.
- No sustituye validación específica del entorno, tests o revisión experta.
- Detenerse y preguntar si faltan inputs, permisos o criterios de éxito.
