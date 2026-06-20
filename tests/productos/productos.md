# Pruebas — Productos

Rol mínimo para modificar: **AGENTE_VENTAS** / **EJECUTIVO_VENTAS**
Rol mínimo para ver: todos los roles autenticados

---

## Listado

### PR-01 Ver catálogo de productos
- [ ] Ir a `/productos`
- **Esperado**: tabla o grid con nombre, SKU, precio, stock (si aplica), estado activo/inactivo

### PR-02 Búsqueda por nombre o SKU
- [ ] Escribir en el buscador parte del nombre o SKU
- **Esperado**: lista filtrada en tiempo real

### PR-03 Filtrar por categoría
- [ ] Seleccionar una categoría del filtro
- **Esperado**: solo productos de esa categoría visibles

---

## Creación

### PR-04 Crear producto mínimo
- [ ] Completar: nombre, precio
- [ ] Guardar
- **Esperado**: producto creado, visible en el catálogo y disponible en cotizaciones/pedidos

### PR-05 Crear producto completo
- [ ] Completar: nombre, SKU, descripción, precio, precio de costo, stock, categoría, unidad de medida
- [ ] Guardar
- **Esperado**: todos los campos guardados y visibles en el detalle

### PR-06 Validaciones
- [ ] Intentar guardar sin nombre → error en campo
- [ ] Precio negativo → error de validación
- [ ] SKU duplicado → error de validación (si aplica)

---

## Edición

### PR-07 Editar precio del producto
- [ ] Cambiar el precio de un producto
- [ ] Guardar
- **Esperado**: nuevo precio reflejado en el catálogo; cotizaciones existentes no se ven afectadas (precio guardado al momento de agregar)

### PR-08 Actualizar stock
- [ ] Modificar el stock disponible de un producto
- [ ] Guardar
- **Esperado**: stock actualizado en el listado

### PR-09 Desactivar producto
- [ ] Marcar un producto como inactivo
- **Esperado**: no aparece en el selector de productos al crear cotizaciones o pedidos nuevos

---

## Uso en cotizaciones y pedidos

### PR-10 Buscar y agregar producto en cotización
- [ ] Al crear una cotización, buscar un producto por nombre o SKU
- **Esperado**: producto encontrado y agregado con su precio actual

### PR-11 Precio en cotización refleja el precio al momento de agregar
- [ ] Agregar un producto a una cotización → después cambiar el precio del producto
- **Esperado**: la cotización sigue mostrando el precio original al momento del alta

---

## Permisos por rol

### PR-12 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, ver catálogo sin botones de edición
- **Esperado**: puede ver, no puede crear ni editar
