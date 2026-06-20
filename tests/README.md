# Plan de Pruebas — Vento CRM

Pruebas manuales antes de pasar a producción. Cada módulo tiene su propio archivo.

## Roles del sistema

| Rol             | Dashboard | Pipeline | Inbox | Contactos | Oportunidades | Cotizaciones | Pedidos | Configuración |
|-----------------|-----------|----------|-------|-----------|---------------|--------------|---------|---------------|
| OWNER           | rw        | rw       | rw    | rw        | rw            | rw           | rw      | rw            |
| ADMIN           | rw        | rw       | rw    | rw        | rw            | rw           | rw      | rw            |
| GERENTE_VENTAS  | rw        | rw       | rw    | rw        | rw            | rw           | rw      | none          |
| SUPERVISOR      | r         | r        | r     | r         | r             | r            | r       | r             |
| AGENTE_VENTAS   | rw        | rw       | rw    | rw        | rw            | rw           | rw      | none          |
| EJECUTIVO_VENTAS| rw        | none     | none  | r         | none          | rw           | rw      | none          |
| AGENTE_SOPORTE  | rw        | r        | rw    | rw        | r             | none         | r       | none          |
| INVITADO        | r         | r        | r     | r         | r             | r            | r       | none          |

## Módulos

- [Auth — Registro y Login](auth/autenticacion.md)
- [CRM — Contactos](crm/contactos.md)
- [CRM — Empresas](crm/empresas.md)
- [CRM — Oportunidades](crm/oportunidades.md)
- [CRM — Pipeline Kanban](crm/pipeline.md)
- [CRM — Actividades](crm/actividades.md)
- [Ventas — Cotizaciones](sales/cotizaciones.md)
- [Ventas — Pedidos](sales/pedidos.md)
- [Ventas — Transportistas](sales/transportistas.md)
- [Ventas — Flujo de Venta](sales/flujo-venta.md)
- [Productos](productos/productos.md)
- [Conversaciones / Inbox](conversaciones/inbox.md)
- [Configuración general](configuracion/configuracion.md)
- [Eventos del sistema](sistema/eventos.md)

## Convención de estados

```
- [ ] Pendiente
- [x] Aprobado
- [~] Con observaciones (anotar debajo)
- [!] Fallido — requiere fix
```
