# Contratos: Server Actions y queries — Transportistas por país

Todas las Server Actions siguen el patrón ya establecido en `src/sales/transportistas/actions.ts`: validan con Zod, exigen `requirePermisoAction("transportistas", "modificar"|"ver")`, devuelven `ResultadoAccion<T>` (`{ exito: true, data? } | { exito: false, error }`), y llaman `revalidatePath` tras mutar.

## `schema.ts` — cambios de validación

```ts
export const CrearTransportistaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(80),
  tipo: TipoTransportistaEnum,
  paisId: z.string().min(1, "Selecciona un país"), // NUEVO — obligatorio en alta
});

export const EditarTransportistaSchema = CrearTransportistaSchema.extend({
  id: z.string().min(1),
  paisId: z.string().min(1).optional(), // NUEVO — opcional en edición; ver regla de bloqueo abajo
  ...CAMPOS_CONTACTO,
});
```

## `crearTransportista(datos)` — modificado

- Sin cambios de firma ni de permiso.
- `paisId` ahora es parte de `validado.data` y se guarda igual que `nombre`/`tipo` en el `prisma.transportista.create`.
- El historial (`registrarHistorialTransportista`) agrega `paisId` a `valorNuevo`.

## `editarTransportista(datos)` — modificado

**Regla nueva (research.md Decisión 3)**: si `datos.paisId` viene presente y es distinto del `paisId` actual del transportista, la acción MUST verificar cuántas `TarifaTransportistaZona` tiene ese transportista (sin filtrar por `activa`):

```ts
if (campos.paisId !== undefined && campos.paisId !== anterior.paisId) {
  const totalTarifas = await prisma.tarifaTransportistaZona.count({ where: { transportistaId: id } });
  if (totalTarifas > 0) {
    return { exito: false, error: "No se puede cambiar el país de un transportista con tarifas configuradas. Crea un transportista nuevo para operar en otro país." };
  }
}
```

- Si pasa la validación (o `paisId` no viene en el payload, o es igual al actual), se actualiza normalmente.
- El historial agrega `paisId` a `valorAnterior`/`valorNuevo` cuando cambia.

## `obtenerTransportista(id, instanciaId)` / `obtenerTransportistas(instanciaId)` — modificadas

- Ambas agregan `include: { pais: true }` (para bandera/nombre en UI).
- Ambas agregan un segundo conteo, **sin** `where: { activa: true }`:

```ts
_count: { select: { tarifas: { where: { activa: true } }, /* ya existe */ } }
// se agrega, en el mismo select:
tarifasTotal: /* alias vía un segundo _count o un count() aparte */
```

  Devuelto como `tienePaisBloqueado: boolean` (`totalTarifas > 0`) en el objeto que consumen los componentes — nombre elegido para que la UI no tenga que repetir la regla de negocio, solo leer el flag.

## `listarZonasEntrega(instanciaId, busqueda?, paisId?)` — modificada

```ts
export async function listarZonasEntrega(instanciaId: string, busqueda?: string, paisId?: string) {
  return prisma.zonaEntrega.findMany({
    where: {
      instanciaId,
      ...(busqueda ? { nombre: { contains: busqueda, mode: "insensitive" } } : {}),
      ...(paisId ? { ubicaciones: { some: { paisId } } } : {}),
    },
    include: { ubicaciones: { include: { pais: true } }, _count: { select: { tarifas: true } } },
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
  });
}
```

- `listarZonasEntregaAction` (entrypoint client-callable) gana el mismo parámetro opcional, pasado igual.
- Cuando el llamador (`[id]/page.tsx`) tiene un transportista con `paisId` asignado, siempre pasa ese `paisId`. Cuando el transportista está en "país pendiente" (`paisId = null`), no se filtra (no aplica — de todas formas la UI deshabilita "Agregar zona"/"Agregar tarifa" en ese estado, ver más abajo) y se muestra un catálogo vacío/deshabilitado.

## Componentes — contrato de props (sin nuevas Server Actions)

- **`FormTransportista`**: agrega `<SelectorPais>` requerido; `defaultValues` sin `paisId` (el usuario debe elegirlo).
- **`SeccionInformacionTransportista`**: recibe `tienePaisBloqueado: boolean` además de `transportista`; renderiza `<SelectorPais>` deshabilitado (con ícono de candado y texto "No se puede cambiar el país de un transportista con tarifas configuradas") cuando `tienePaisBloqueado` es `true`; si `transportista.paisId` es `null`, muestra un banner "País pendiente — complétalo para poder agregar zonas y tarifas" en vez del candado.
- **`ListaTransportistas`**: cada fila muestra `transportista.pais` (bandera + nombre) junto al nombre comercial cuando existe; si es `null`, muestra un badge "País pendiente" en vez de la bandera.
- **`PanelTransportista`**: el encabezado muestra la bandera + nombre del país junto al `<h1>` cuando existe; si es `null`, muestra el mismo badge "País pendiente" y deshabilita las acciones de "Agregar zona"/"Agregar tarifa" en `SeccionZonasTarifas` (con tooltip explicando por qué).
- **`DialogZonaEntrega`**: cambia su interfaz — ya no permite elegir país libremente:

  ```ts
  interface DialogZonaEntregaProps {
    paisId: string;        // heredado del transportista — ya no hay SelectorPais dentro del diálogo
    paisLabel: string;     // "🇵🇦 Panamá" — solo para mostrar, campo deshabilitado
    onCreada: (zona: { id: string; nombre: string }) => void;
  }
  ```

  `defaultValues.ubicaciones[0].paisId` se inicializa con la prop `paisId` y no se vuelve a tocar; el campo país del formulario se renderiza como texto deshabilitado con candado (no como `<SelectorPais>`). El campo `provinciaEstado` cambia de `<Input>` a `<SelectorEstadoProvincia paisId={paisId} .../>`.
- **`SeccionZonasTarifas`**: recibe `paisId: string | null` del transportista; si es `null`, deshabilita los botones "Agregar zona" y "Agregar tarifa" (con tooltip "Completa el país del transportista para configurar zonas"); si no es `null`, lo pasa hacia abajo a `DialogZonaEntrega` y usa el `zonas`/`servicios` ya filtrados que le llegan desde la page (Decisión 1 de research.md — el filtrado ocurre en la query, no en el componente).

## Script de backfill — contrato de ejecución

`scripts/backfill-pais-transportista.ts` — sin Server Action asociada (se ejecuta una vez, fuera de la app, mismo patrón que `scripts/seed-geografia.ts`):

- **Entrada**: ninguna (lee `DATABASE_URL` del entorno, igual que los demás scripts de `scripts/`).
- **Efecto**: `UPDATE Transportista SET paisId = ... WHERE id = ...` solo para transportistas con `paisId IS NULL` y exactamente un país inferible (ver [data-model.md](../data-model.md)).
- **Salida esperada**: log por transportista (`"UnoExpress: paisId asignado a Panamá (PA)"` o `"Mensajería Directa: sin país inferible, queda pendiente"`), y un resumen final (`N asignados automáticamente, M pendientes`).
- **Idempotencia**: correrlo dos veces no cambia nada en transportistas que ya tienen `paisId` (el `WHERE paisId IS NULL` los excluye).
