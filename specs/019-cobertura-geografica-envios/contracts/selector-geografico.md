# Contrato: selector de país / estado-provincia (UI)

Componentes compuestos reutilizables, no una tool ni una Server Action — documentados aquí porque son la interfaz que ven configuración de transportista, configuración geográfica de la instancia, y los formularios de cotización/pedido (los cuatro puntos de uso listados en `plan.md`).

## Query de datos (TanStack Query, solo lectura)

```ts
listarPaises(): Promise<Array<{
  id: string; codigo: string; codigoAlpha3: string | null;
  nombre: string; banderaEmoji: string | null; indicativoTelefonico: string | null;
}>>

listarEstadosProvincia(paisId: string): Promise<Array<{
  id: string; codigo: string | null; nombre: string;
}>>
```

`listarPaises()` no recibe `instanciaId` — es catálogo global, cacheable de forma agresiva (`staleTime` largo, ej. 24h) porque prácticamente nunca cambia. `listarEstadosProvincia(paisId)` se cachea por `paisId`.

## `SelectorPais` (`src/shared/entregas/components/selector-pais.tsx`)

```ts
interface SelectorPaisProps {
  value: string | null;       // paisId
  onChange: (paisId: string | null) => void;
  disabled?: boolean;
}
```

Combobox (`Popover` + `Command`, research.md Decisión 2b) — cada opción renderiza `{banderaEmoji} {nombre} ({codigo})`, filtrable escribiendo el nombre o el código ISO2/ISO3.

**No se renderiza en absoluto** cuando el formulario que lo embebe está en contexto `modoGeografico = UN_SOLO_PAIS` (FR-011) — la decisión de mostrarlo u ocultarlo la toma el formulario contenedor, no el componente (mantiene el componente puro/reutilizable también para la configuración de cobertura de transportista, donde sí puede hacer falta incluso en modo un solo país si el negocio decide excepcionalmente dar cobertura fuera de su país operativo — ver Edge Case de `spec.md` sobre cambio de modo).

## `SelectorEstadoProvincia` (`src/shared/entregas/components/selector-estado-provincia.tsx`)

```ts
interface SelectorEstadoProvinciaProps {
  paisId: string | null;      // si es null, el componente se muestra deshabilitado con placeholder "Elige un país primero"
  value: string | null;       // estadoProvinciaId
  onChange: (estadoProvinciaId: string | null) => void;
  disabled?: boolean;
}
```

Mismo patrón Combobox; la lista se recarga (`listarEstadosProvincia`) cada vez que cambia `paisId`, limpiando `value` si el estado seleccionado ya no pertenece al país nuevo.

## Reutilización

Los cuatro puntos de uso (`seccion-cobertura-geografica.tsx` en transportistas, la sección de configuración geográfica de instancia, `form-cotizacion.tsx`, `form-entrega.tsx`) importan estos dos componentes directamente — ninguno reimplementa su propio dropdown de país/estado. Esto es exactamente el tipo de "sección compuesta que aparece en múltiples páginas" que, según el skill `design-systems` del proyecto, debe vivir en un lugar compartido en vez de copiarse.
