# Data Model: Enriquecer el contacto de Facebook Messenger

**Feature**: `007-enriquecer-contacto-messenger` | **Date**: 2026-08-27

Sin tablas ni columnas nuevas. Se reutilizan íntegramente `Contacto` y `ContactoIdentificadorCanal`, ya existentes y ya usados por Instagram/WhatsApp/Email.

## Mapeo campo de Meta → campo de Karia

| Campo de Meta (`GET /<PSID>?fields=...`) | Campo de Karia | Notas |
|---|---|---|
| `first_name` + `last_name` | `Contacto.nombre` (vía `pushName` en el payload normalizado) | Se concatenan `"first_name last_name"`, mismo criterio que Instagram usa `name` directo. Solo se aplica si `Contacto.nombre` está vacío (regla ya existente en `procesarMensajeEntrante`, sin cambios) |
| `profile_pic` | `Contacto.avatarUrl` (vía `avatarUrl` en el payload normalizado) | Solo se aplica si `Contacto.avatarUrl` no está seteado (regla ya existente, sin cambios). La URL de Meta expira — mismo comportamiento que ya acepta Instagram hoy (no se re-descarga ni se guarda una copia propia) |
| — (no existe campo) | `ContactoIdentificadorCanal.handle` | Facebook no expone un nombre de usuario público equivalente al `username` de Instagram — este campo queda `null` para contactos de Messenger, a diferencia de Instagram que sí lo completa |
| `email` | — | No disponible — no se completa (FR-005) |
| `phone` / `phone_number` | — | No disponible — no se completa (FR-005) |

## Reglas de validación (heredadas, no nuevas)

- `procesarMensajeEntrante` (`src/conversaciones/actions.ts`) ya aplica, sin cambios: `nombre` solo se completa si estaba vacío; `avatarUrl` solo se completa si no existía. Esto ya cubre FR-003 para cualquier canal, incluido Messenger, sin código adicional.
- La consulta a Meta para pedir el perfil MUST tolerar cualquier error (rechazo por falta de aprobación, contacto sin datos públicos, error de red) devolviendo un perfil vacío en vez de lanzar una excepción — mismo patrón que `obtenerPerfilRemitenteIG` ya usa (FR-004).
