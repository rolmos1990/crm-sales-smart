# Regla obligatoria para `<Select>` (`src/components/ui/select.tsx`)

## El bug

El `Select` del proyecto (`src/components/ui/select.tsx`) envuelve
`@base-ui/react/select`, **no** Radix. `Select.Value` (nuestro `<SelectValue />`)
resuelve la etiqueta a mostrar en el trigger buscándola en una lista de
`items` que el propio componente arma **registrando los `<SelectItem>` que
llegan a montarse en el DOM** — y el popup (`SelectContent`) solo se monta la
primera vez que el usuario lo abre (`shouldRender = mounted || forceMount` en
`SelectPortal`).

Consecuencia: en el primer render, con un `value`/`defaultValue` ya
seleccionado, **no hay ningún `item` registrado todavía** → `SelectValue` no
encuentra con qué resolver la etiqueta y cae a mostrar el `value` crudo (el
`key`) en vez del texto legible. Ejemplos vistos: `AND`/`OR` en vez de
"Cumplir todas (Y)" / "Cumplir cualquiera (O)", `IGUAL`/`DIFERENTE` en vez de
"es igual a" / "es diferente de".

## La regla

**Todo `<Select>` cuyo `value` de las `<SelectItem>` no sea idéntico visualmente
a su etiqueta debe recibir la prop `items` en el `<Select>` raíz**, con el
mapa `valor → etiqueta` completo (no solo la opción actualmente seleccionada).
Esto le da a `SelectValue` una fuente de verdad inmediata, sin depender de que
el popup ya se haya montado.

Formato de `items` (ver tipo `SelectRootProps.items` en
`@base-ui/react/select`): `Record<string, ReactNode>` — el mismo shape que
`Object.fromEntries(opciones.map(o => [o.valor, o.etiqueta]))`.

```tsx
// ❌ Mal — el trigger muestra "AND" hasta que el usuario abre el popup una vez
<Select value={valor} onValueChange={onChange}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="AND">Cumplir todas (Y)</SelectItem>
    <SelectItem value="OR">Cumplir cualquiera (O)</SelectItem>
  </SelectContent>
</Select>

// ✅ Bien
<Select
  items={{ AND: "Cumplir todas (Y)", OR: "Cumplir cualquiera (O)" }}
  value={valor}
  onValueChange={onChange}
>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="AND">Cumplir todas (Y)</SelectItem>
    <SelectItem value="OR">Cumplir cualquiera (O)</SelectItem>
  </SelectContent>
</Select>
```

Para opciones dinámicas (vienen de una query, de un catálogo, etc.), construye
`items` con el mismo `Object.fromEntries(...)` a partir del mismo arreglo que
ya usas para renderizar los `<SelectItem>` — nunca lo escribas a mano por
separado, para que no se desincronicen.

## Cuándo se puede omitir

Solo cuando el `value` de cada opción **es literalmente el mismo texto** que
se le muestra al usuario (ej. un Select de un solo dígito donde value="1" y
label="1"). Ante la duda, agrega `items` — no tiene costo y evita el bug.

## Checklist al tocar o crear un `<Select>`

1. ¿El `value` de las `SelectItem` es igual a lo que ve el usuario? Si no →
   agrega `items` al `<Select>` raíz.
2. ¿El Select puede montarse ya con un valor seleccionado (`defaultValues`,
   datos cargados del servidor, edición de un registro existente)? Ese es
   justo el caso que revela el bug si falta `items` — pruébalo recargando la
   pantalla en modo edición, no solo creando un registro nuevo.
3. Si las opciones son dinámicas, deriva `items` del mismo arreglo/mapa que
   alimenta los `<SelectItem>`.
