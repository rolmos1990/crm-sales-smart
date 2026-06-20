# Pruebas — Empresas

Rol mínimo para modificar: **AGENTE_VENTAS**
Rol mínimo para ver: **INVITADO**

---

## Listado y búsqueda

### E-01 Ver lista de empresas
- [ ] Ir a `/crm/empresas`
- **Esperado**: tabla con nombre, industria, tamaño, sitio web

### E-02 Búsqueda por nombre
- [ ] Escribir en el buscador parte del nombre de una empresa
- **Esperado**: lista filtrada en tiempo real

---

## Creación

### E-03 Crear empresa mínima
- [ ] Completar solo el nombre
- [ ] Guardar
- **Esperado**: empresa creada y visible en la lista

### E-04 Crear empresa completa
- [ ] Completar: nombre, industria, tamaño, sitio web, dirección, teléfono, notas
- [ ] Guardar
- **Esperado**: todos los datos guardados y visibles en el detalle

### E-05 Validación de nombre requerido
- [ ] Intentar guardar sin nombre
- **Esperado**: error de validación en el campo

---

## Detalle y edición

### E-06 Ver contactos asociados a la empresa
- [ ] Abrir detalle de una empresa que tiene contactos vinculados
- **Esperado**: lista de contactos visible en la sección correspondiente

### E-07 Ver oportunidades asociadas
- [ ] Empresa con oportunidades vinculadas
- **Esperado**: oportunidades listadas con valor y etapa

### E-08 Editar empresa
- [ ] Cambiar nombre e industria → guardar
- **Esperado**: cambios reflejados en el detalle y en la lista

### E-09 Eliminar empresa
- [ ] Eliminar una empresa sin contactos ni oportunidades vinculadas
- **Esperado**: empresa eliminada sin errores
- [ ] Intentar eliminar empresa con contactos vinculados
- **Esperado**: comportamiento esperado (error o eliminación en cascada — verificar)

---

## Permisos por rol

### E-10 AGENTE_SOPORTE solo lectura en empresas
- [ ] Con rol AGENTE_SOPORTE (empresas: `r`), intentar editar
- **Esperado**: botón de editar no visible
