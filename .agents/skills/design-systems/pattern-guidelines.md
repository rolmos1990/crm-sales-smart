# Pattern Guidelines

Cómo generar un patrón compuesto reutilizable (secciones que se repiten entre páginas/módulos)
a partir de los primitivos del proyecto, en vez de copiar markup entre CRM y Sales.

Adaptado de [StyleSeed](https://github.com/bitjaru/styleseed) (skill `ui-pattern`) a las
convenciones reales de este proyecto.

## Cuándo usar

- Se necesita un patrón de layout reutilizable en vez de una sección de una sola página
- Una página repite el mismo arreglo de cards, filas, filtros o bloques de datos
- Se quiere construir a partir de primitivos existentes de `src/components/ui/` en vez de copiar markup
- Se quiere un componente de patrón con props para contenido dinámico

## Familias de patrones comunes

card section · grid de dos columnas · scroller horizontal · list section · form section ·
stat grid · tabla de datos · detail card · filter bar

## Cómo hacerlo

### 1. Identificar el tipo de patrón

Ver la lista de familias arriba y elegir la que mejor calza.

### 2. Revisar los building blocks disponibles

- `src/components/ui/` — primitivos
- Patrones ya existentes en el proyecto para reutilizar en vez de duplicar:
  - Cards KPI con skeleton (`src/app/crm/page.tsx`)
  - Tablas de lista con link y badge (`lista-contactos.tsx`, `lista-empresas.tsx`)
  - Forms con `<Form>` + `<FormField>` (`form-contacto.tsx`, `form-empresa.tsx`)

El objetivo es composición, no duplicación.

### 3. Mantener las reglas de layout del proyecto

- Superficies de card sobre tokens semánticos (ver `visual-language.md`)
- Radios de borde de la escala del sistema
- Tokens de sombra en vez de valores de sombra improvisados
- Padding interno consistente
- Wrappers de sección alineados al sistema de márgenes de la página

### 4. Hacer el patrón dinámico

Exponer datos vía props en vez de hardcodear contenido. Si el patrón tiene varias variantes,
mantener la API explícita y pequeña.

### 5. Mantener el patrón reutilizable entre módulos

Evitar asunciones específicas de una página salvo que el usuario pida explícitamente una
sección puntual. Si el markup solo funciona en una ruta, probablemente pertenece a un
componente de esa página, no a un patrón compartido.

## Output esperado

1. El componente de patrón generado
2. La ubicación destino
3. Props esperadas y ejemplo de uso
4. Notas sobre qué primitivos existentes se reutilizaron

## Buenas prácticas

- Empezar desde el building block existente más pequeño que resuelva el problema
- Mantener separadas las responsabilidades de container, section e item
- Usar tokens y reglas de espaciado de forma consistente
- Preferir extender un patrón existente antes que agregar un hermano casi-duplicado

## Limitations
- Usar este documento solo cuando la tarea calza con el alcance descrito arriba.
- No sustituye validación específica del entorno, tests o revisión experta.
- Detenerse y preguntar si faltan inputs, permisos o criterios de éxito.
