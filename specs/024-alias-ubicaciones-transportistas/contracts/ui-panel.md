# Contrato de UI: Alias de destino e importación de destinos/tarifas

Extiende el panel de transportista ya existente (`/sales/transportistas/[id]`, pestaña "Zonas y tarifas", ver `specs/022-transportistas-zonas-tarifas/contracts/ui-panel.md`). No se crea una pestaña nueva ni un grid editable tipo hoja de cálculo (no hay precedente de ese tipo de componente en el proyecto — ver auditoría en `research.md`).

## Gestión de alias — pestaña "Zonas y tarifas"

- En `seccion-zonas-tarifas.tsx`, el **nombre de la zona** (encabezado de cada grupo de tarifas) gana un botón/ícono secundario "Alias" que abre `dialog-alias-ubicacion.tsx`.
- `dialog-alias-ubicacion.tsx` (nuevo): lista, para esa `ZonaEntrega`, cada una de sus `ZonaEntregaUbicacion` (con su `nombreVisible`) y, debajo de cada una, sus alias existentes como `Badge` con botón de eliminar (`Trash2`, mismo patrón visual que `dialog-zona-entrega.tsx`), más un input + botón "Agregar alias" al pie de cada ubicación.
- Alta de alias: input de texto simple; el nivel geográfico (`campo`) se infiere automáticamente en el servidor (no se le pide al usuario elegirlo en el caso simple) — solo se expone un selector de nivel si la ubicación tiene más de un nivel no vacío y el usuario abre "más opciones" (caso avanzado, no bloqueante para el flujo principal).
- Cada alta/baja es una acción atómica (`agregarAliasUbicacion`/`eliminarAliasUbicacion`) — sin botón de "guardar cambios" del diálogo completo, coherente con cómo ya se comportan otras listas de este tipo en el proyecto (ej. `EditorListaTexto` en `sheet-editar-agente.tsx`).

## Importación de destinos — nuevo flujo, disparado desde la misma pestaña

- Botón "Importar destinos" en el header de `seccion-zonas-tarifas.tsx` (junto a "Agregar zona"), abre `wizard-importacion-destinos.tsx` (nuevo, en `src/sales/transportistas/importacion-destinos/components/`) — mismo look & feel de wizard paso a paso que `wizard-importacion.tsx` de `src/crm/datos/` (indicador de pasos, mismos controles de navegación), pero con su propia lógica (ver `research.md §7`).

**Pasos**:

1. **Archivo**: subir CSV/Excel o pegar una tabla — reutiliza `parsearArchivo()`/`detectarSeparador()` de `src/crm/datos/utils/`.
2. **Mapeo de columnas**: columnas fijas conocidas del dominio (`zonaNombre`, `provinciaEstado`, `distritoCiudad`, `corregimiento`, `sectorOCodigoPostal`, `alias`, `servicioNombre`, `costoInterno`, `precioCliente`, `tiempoMinimoDias`, `tiempoMaximoDias`) — a diferencia del wizard genérico, no son configurables por el usuario (este dominio no tiene campos personalizados).
3. **Revisión** (`paso-revision.tsx`, el paso central de este flujo): tabla agrupada por estado —
   - `NUEVO` / `COINCIDENCIA_EXACTA`: checkbox "incluir" premarcado, sin interacción adicional.
   - `POSIBLE_DUPLICADO`: radio por fila — "Crear como destino nuevo" / "Es el mismo destino que: {nombreVisible del candidato}".
   - `ALIAS_AMBIGUO`: fila bloqueada (no seleccionable) con mensaje explicando que el alias coincide con más de un destino — el usuario debe editar el archivo o excluir la fila.
   - Resumen al pie: "N destinos válidos · N requieren revisión · N posibles duplicados" (mismo estilo que el ejemplo de `requerimiento-transportista.md`, sección 5, paso 5).
4. **Confirmación**: botón "Importar" deshabilitado mientras queden filas `ALIAS_AMBIGUO` sin excluir; al confirmar, corre `confirmarImportacionDestinosAction` y muestra el resultado final (creados/actualizados/con error), igual que el wizard genérico al terminar.

## Responsive / temas

Mismos tokens semánticos y componentes `shadcn/ui` ya aprobados (`bg-card`, `text-foreground`, `border-border`) — sin valores arbitrarios de color. La tabla de revisión usa `overflow-x: auto` en su contenedor, igual que el resto de tablas del proyecto.
