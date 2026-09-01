# Contratos: Enrutamiento de modelos de IA por objetivo

## Función interna — `resolverProveedorPorObjetivo` (`src/ai/orquestador/orquestador.ts`)

```ts
function resolverProveedorPorObjetivo(
  instanciaId: string,
  tarea: TareaIA,
  requiereRazonamientoSuperior?: boolean,
): Promise<ProveedorIA | null>
```

- **Comportamiento**: busca entre los `ProveedorIA` activos de `instanciaId` el que tenga, en `casosDeUso.objetivos`, el valor `"CHAT_RAZONAMIENTO_SUPERIOR"` (si `tarea === "CHAT"` y `requiereRazonamientoSuperior === true`) o el valor de `tarea` (en cualquier otro caso). Devuelve `null` si ninguno coincide — el llamador (`seleccionarProveedor`) cae al criterio actual.
- **Uso**: llamada desde `seleccionarProveedor` antes de aplicar el ordenamiento por `tipoAgenteIA`.

## `guardarAsignacionesObjetivoIA(asignaciones)` — Server Action nueva

- **Input**: `asignaciones: Array<{ objetivo: ObjetivoEnrutamiento; proveedorIAId: string | null }>` (una entrada por cada uno de los 7 objetivos, `proveedorIAId: null` = usar criterio por defecto)
- **Output**: `{ exito: true } | { exito: false; error: string }`
- **Comportamiento**: valida sesión + permiso `"ia"`; para cada asignación con `proveedorIAId` no nulo, valida que exista un `ProveedorIA` activo con ese id en `sesion.instanciaId` (FR-003); persiste actualizando `casosDeUso` de cada `ProveedorIA` afectado (agregando/quitando el objetivo de su lista según corresponda) dentro de una transacción.
- **Errores**: objetivo apuntando a un proveedor inactivo/inexistente → `"El proveedor seleccionado para '{objetivo}' no está activo"`.

## `obtenerAsignacionesObjetivoIA()` — Server Action nueva

- **Input**: ninguno (usa `sesion.instanciaId`)
- **Output**: `Array<{ objetivo: ObjetivoEnrutamiento; proveedorIAId: string | null; proveedorNombre: string | null; proveedorInvalido: boolean }>`
- **Comportamiento**: lee todos los `ProveedorIA` de la instancia y arma el mapa inverso `objetivo → proveedor`; `proveedorInvalido: true` cuando la asignación guardada apunta a un proveedor que ya no está `activo` (FR-008) — la UI lo muestra como advertencia sin bloquear la pantalla.

## Extensión de `SolicitudIA` / `SolicitudConHerramientas` (`src/ai/gateway/types.ts`)

```ts
interface SolicitudIA {
  // ...campos existentes sin cambio...
  requiereRazonamientoSuperior?: boolean; // solo aplica cuando tarea === "CHAT"
}
```

Sin cambios de firma en `generarRespuesta`/`generarConHerramientas` — el campo nuevo es opcional y se lee internamente para pasarlo a `seleccionarProveedor`.
