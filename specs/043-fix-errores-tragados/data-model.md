# Data Model: Las páginas dejan de esconder los fallos de lectura

**Feature**: 043-fix-errores-tragados

## Sin cambios en el modelo de datos

Este hotfix no agrega, modifica ni elimina entidades, campos, relaciones, índices ni migraciones de Prisma. Tampoco cambia ninguna query: las mismas funciones de `queries.ts` se llaman con los mismos argumentos y devuelven lo mismo.

Lo único que cambia es el **flujo de control de la lectura** en las páginas: qué ocurre cuando una de esas llamadas lanza una excepción.

## Lo que sí cambia de forma observable

No es el modelo de datos, pero sí altera qué valores pueden existir en tiempo de ejecución, y conviene tenerlo explícito porque es la base de varios requisitos.

| Variable de página | Antes podía valer | Ahora solo puede valer |
|---|---|---|
| Un registro de detalle (contacto, empresa, oportunidad, cotización, pedido) | el registro, `null` porque no existe, o `null` **porque la lectura falló** | el registro, o `null` porque no existe |
| Una colección de listado | sus filas, `[]` porque no hay datos, o `[]` **porque la lectura falló** | sus filas, o `[]` porque no hay datos |
| Un KPI o total | su valor, o `0` **porque el cálculo falló** | su valor |
| `etapasFlujo` en el listado de pedidos | las etapas, `[]` porque la instancia no tiene flujo dinámico, o `[]` **porque la lectura falló** | las etapas, o `[]` porque la instancia no tiene flujo dinámico |
| Un valor por defecto de formulario (moneda, país, filtro de catálogo) | el valor configurado, o un valor cableado **porque la lectura falló** | el valor configurado |

En las cinco filas, el cambio es el mismo: **se elimina el tercer significado**, el que era indistinguible de los otros dos y por eso producía pantallas que mienten.

La última fila de `etapasFlujo` es la que importa para 038: `[]` vuelve a significar una sola cosa, y `construirCondicionVenta` vuelve a ser determinista respecto de la configuración de la instancia. Su comportamiento —incluido el fallback legacy por enum `estado`— no se modifica (FR-009).

## Entidades afectadas

Ninguna. Para el detalle de qué archivo se toca y cómo, ver [`contracts/catches-permitidos.md`](./contracts/catches-permitidos.md).
