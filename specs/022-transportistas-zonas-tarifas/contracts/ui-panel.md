# Contrato de UI: Panel de configuración de transportista

Reemplaza `dialog-transportista.tsx` (tipo="editar") como experiencia principal de edición (FR-003). El modal se conserva solo para creación rápida.

## Flujo

1. **Modal de creación rápida** (`dialog-transportista.tsx`, recortado): solo `nombre`, `tipo`, `estado` (activo). Al guardar (`crearTransportista`), redirige a `/sales/transportistas/[id]`.
2. **Página `/sales/transportistas/[id]`** (nueva, Server Component): encabezado con `nombre`, badge de `tipo`, badge de estado activo/inactivo, contador "N zonas configuradas" (cuenta de `TarifaTransportistaZona` con `activa: true`, zonas distintas); botón "Volver" (`Link` a `/sales/transportistas`); botón "Guardar cambios" (submit del formulario de la pestaña activa); `Tabs` con `Información` / `Zonas y tarifas` / `Condiciones` — mismo componente `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` que ya usa el resto de Karia (`src/app/configuracion/page.tsx`).

## Pestaña Información

Reutiliza `form-transportista.tsx` extendido con los 4 campos nuevos (`personaContacto`, `telefono`, `correoElectronico`, `notasInternas`) + botón "Desactivar transportista" (llama `toggleTransportista`, con confirmación).

## Pestaña Zonas y tarifas

Nuevo componente `seccion-zonas-tarifas.tsx`, reemplaza `seccion-cobertura-geografica.tsx` (retirado, Decisión 1 de research.md). Estructura:

- Header con buscador de zonas (`Input` con icono de búsqueda) + botón "Agregar zona" (abre un diálogo liviano `dialog-zona-entrega.tsx` para crear una `ZonaEntrega` sin salir del flujo, FR-012).
- Tabla editable (mismo patrón de tabla que `lista-proveedores-ia.tsx`/`lista-contactos.tsx`: filas con `Badge` de estado, iconos de acción): columnas Zona · Servicio · Costo · Precio cliente · Margen (calculado en el cliente, `precioCliente - costoInterno`) · Entrega (`tiempoMinimoDias`–`tiempoMaximoDias`) · Estado · Acciones (editar inline, duplicar, activar/desactivar, eliminar solo si `usada: false`, dato que la query ya trae precalculado).
- Fila de tarjetas KPI al pie: "N tarifas activas", "Costo promedio", "Margen promedio" (mismo estilo que las cards KPI de `crm/page.tsx`, patrón ya establecido en `design-systems`).
- Advertencia inline (no bloqueante) cuando `precioCliente < costoInterno` en la fila que se está editando (FR-025).
- Acción "Aplicar a varias zonas" sobre un servicio: abre un diálogo con selección múltiple de zonas + los campos a cambiar (FR-021).

## Pestaña Condiciones

Nuevo componente `seccion-condiciones-transportista.tsx`, con 3 bloques visuales (Operación / Restricciones / Cobro y coordinación) tal como en el mockup: switches para los booleanos (`permiteEntregaMismoDia`, `requiereDireccionCompleta`, `permiteArticulosFragiles`, `permitePagoContraEntrega`), selector de días de semana (multi-toggle), selects para `horaLimiteMismoDia`/`tiempoPreparacionDias`/`pesoMaximoKg`/`metodoPagoTransportista`/`frecuenciaFacturacion`, inputs de texto para `responsableCoordinacion`/`instruccionesCoordinacion`/`observaciones`. Nota de pie: "Estas condiciones se aplicarán al crear cotizaciones y pedidos con {nombre}."

## Cotización / Pedido — sección de entrega (extendida, no nueva)

`form-cotizacion.tsx`/`form-entrega.tsx` (existentes) ganan: selector de zona (con badge "detectada automáticamente" o "asignada manualmente"), selector de transportista+servicio poblado por las opciones que devuelve la resolución de zona (ordenadas por precio, con precio destacado y costo/margen visibles solo si `verificarAcceso(sesion, "transportistas-costos", "ver")`), toggle "Costo por confirmar", campo de costo manual (habilitado solo con permiso `"transportistas-costos" modificar"`), y un ícono "ⓘ" que abre las condiciones operativas del transportista seleccionado en un popover (consulta de solo lectura, FR-032). El pedido (`seccion-entrega.tsx`) muestra el mismo bloque en modo lectura, con los valores ya congelados del snapshot.

## Responsive / temas

Todo el panel usa los mismos tokens semánticos (`bg-card`, `text-foreground`, `border-border`) y componentes `shadcn/ui` ya aprobados — sin valores arbitrarios de color. La tabla de tarifas usa `overflow-x: auto` en su contenedor para no romper el layout en mobile (mismo patrón que el resto de tablas de Karia).
