# Data Model: Pantallas de error con la identidad de Karia

**Feature**: 044-pantallas-de-error

## Sin cambios en el modelo de datos

Esta Feature no agrega, modifica ni elimina entidades, campos, relaciones, índices ni migraciones. Tampoco introduce consultas nuevas: las pantallas no leen datos de negocio.

La única lectura de contexto en toda la Feature es la del `app/not-found.tsx` raíz, que consulta la sesión para decidir a dónde apunta su enlace de salida (FR-007). Usa la resolución de sesión que ya existe; no agrega consulta propia.

## Las dos piezas de estado que sí importan

No son datos persistidos, pero gobiernan qué ve el usuario y conviene tenerlas explícitas.

| Pieza | De dónde sale | Para qué se usa | Qué NO puede hacer |
|---|---|---|---|
| `error.digest` | Lo genera el entorno al registrar la excepción del lado del servidor | Código de soporte visible (FR-004) | No es un identificador de negocio, no se persiste, no se reutiliza entre errores |
| Hay sesión / no hay sesión | Resolución de sesión existente, leída solo en el 404 raíz | Decide si la salida va a la aplicación o al inicio de sesión (FR-007) | No decide permisos ni habilita nada: solo elige un destino de enlace |

En producción, el mensaje original de un error de servidor se reemplaza por uno genérico y lo único que sobrevive hacia el cliente es `digest`. Esa es exactamente la propiedad que FR-005 necesita —que no se filtren detalles— y por eso el diseño se apoya en ella en vez de pelearla.

## Entidades afectadas

Ninguna. Para el detalle de qué archivo se crea y qué promete, ver [`contracts/pantallas-de-error.md`](./contracts/pantallas-de-error.md).
