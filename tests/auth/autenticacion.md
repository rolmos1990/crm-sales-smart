# Pruebas — Autenticación

## Registro de cuenta nueva

### R-01 Registro exitoso
- [ ] Ir a `/registro`
- [ ] Completar: nombre, apellido, nombre de empresa, email, contraseña
- [ ] Enviar el formulario
- **Esperado**: redirige al dashboard, la instancia queda creada, pipeline default generado, se recibe email de bienvenida

### R-02 Email ya registrado
- [ ] Intentar registrar con un email que ya existe en el sistema
- **Esperado**: mensaje de error claro, no se crea cuenta duplicada

### R-03 Validaciones del formulario
- [ ] Enviar formulario vacío → mensajes de error en todos los campos requeridos
- [ ] Contraseña corta (< 8 caracteres) → error de validación
- [ ] Email con formato inválido → error de validación

---

## Login

### L-01 Login con credenciales correctas
- [ ] Ir a `/login`
- [ ] Ingresar email y contraseña válidos
- **Esperado**: redirige al dashboard

### L-02 Credenciales incorrectas
- [ ] Email correcto + contraseña incorrecta
- **Esperado**: mensaje de error sin revelar si el email existe

### L-03 Magic Link
- [ ] Ir a `/auth/magiclink`
- [ ] Ingresar email registrado
- **Esperado**: email con enlace de acceso enviado, al hacer clic en el enlace entra directo al dashboard

### L-04 Restablecimiento de contraseña
- [ ] Solicitar reset de contraseña con email válido
- [ ] Recibir email y seguir el enlace a `/auth/reset-password`
- [ ] Ingresar nueva contraseña
- **Esperado**: puede hacer login con la nueva contraseña

---

## Sesión y permisos básicos

### S-01 Redireccionamiento sin sesión
- [ ] Ir a `/crm/contactos` sin estar autenticado
- **Esperado**: redirige a `/login`

### S-02 Persistencia de sesión
- [ ] Iniciar sesión, cerrar pestaña, reabrir
- **Esperado**: sigue autenticado sin tener que volver a hacer login

### S-03 Cierre de sesión
- [ ] Hacer clic en "Cerrar sesión" desde el menú de usuario
- **Esperado**: redirige a `/login`, no puede acceder a rutas protegidas

### S-04 Acceso denegado por rol
- [ ] Con rol EJECUTIVO_VENTAS intentar acceder a `/crm/pipeline`
- **Esperado**: redireccionado o pantalla de acceso denegado (no ve el módulo en el menú)
