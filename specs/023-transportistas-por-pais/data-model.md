# Data Model: Transportistas por país

Sin modelos nuevos. Una columna nueva sobre `Transportista` y ninguna otra migración de esquema — todo lo demás son cambios de consulta (filtros/includes) sobre modelos ya existentes de spec 019 y 022.

## `Transportista` (extendido)

```prisma
model Transportista {
  id            String            @id @default(cuid())
  nombre        String
  tipo          TipoTransportista @default(COURIER_EXTERNO)
  activo        Boolean           @default(true)
  creadoEn      DateTime          @default(now())
  actualizadoEn DateTime          @updatedAt

  personaContacto   String?
  telefono          String?
  correoElectronico String?
  notasInternas     String?

  // 023-transportistas-por-pais — nullable a nivel de BD (research.md
  // Decisión 2): obligatorio por regla de negocio para transportistas
  // nuevos, pero un transportista existente puede quedar sin país
  // ("país pendiente") tras el backfill si no se pudo inferir sin
  // ambigüedad. Una vez que el transportista tiene alguna
  // TarifaTransportistaZona, este campo queda de solo lectura
  // (research.md Decisión 3, aplicado en la Server Action, no en el schema).
  paisId String?
  pais   Pais?   @relation(fields: [paisId], references: [id], onDelete: Restrict)

  instanciaId String?
  instancia   Instancia? @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  entregas           EntregaPedido[]
  entregasCotizacion EntregaCotizacion[]

  servicios   ServicioTransportista[]
  tarifas     TarifaTransportistaZona[]
  condiciones CondicionesTransportista?

  @@index([instanciaId])
  @@index([paisId])
}
```

**Cambios respecto al modelo actual**: se agregan `paisId`/`pais` (relación a `Pais`, spec 019) y el índice `@@index([paisId])`. `Pais` gana la relación inversa `transportistas Transportista[]` (simétrica a las que ya tiene con `EntregaCotizacion`/`EntregaPedido`/`ZonaEntregaUbicacion`/`ConfiguracionEmpresa`).

**Validación de negocio** (no expresable en el esquema, ver [contracts/server-actions.md](contracts/server-actions.md)):
- Alta (`crearTransportista`): `paisId` obligatorio.
- Edición (`editarTransportista`): `paisId` opcional en el payload, pero rechazado por la Server Action si el transportista ya tiene alguna fila en `TarifaTransportistaZona` (activa o inactiva).

## `Pais` (sin cambios de esquema, nueva relación inversa)

Ya existe (spec 019). Único cambio: relación inversa `transportistas Transportista[]` para reflejar el nuevo FK. `onDelete: Restrict` en `Transportista.paisId` sigue el mismo criterio que las demás FKs hacia `Pais` (`ZonaEntregaUbicacion`, `EntregaCotizacion`, `EntregaPedido` usan `SetNull`/`Restrict` según si el dato es histórico o de configuración activa — `Transportista` es configuración activa, como `ConfiguracionEmpresa.paisOperacionId`, así que usa `Restrict`: no se puede borrar del catálogo un país mientras algún transportista lo tenga asignado).

## `ZonaEntrega` / `ZonaEntregaUbicacion` / `TarifaTransportistaZona` (sin cambios de esquema)

Sin cambios de estructura (research.md Decisión 1). Cambian únicamente las consultas que los leen:

- `listarZonasEntrega(instanciaId, busqueda?, paisId?)` — nuevo parámetro opcional `paisId`; cuando se pasa, agrega `ubicaciones: { some: { paisId } }` al `where`.
- `obtenerTransportista` / `obtenerTransportistas` — agregan `include: { pais: true }` y un conteo `_count.tarifas` **sin** `where: { activa: true }` (a diferencia del `zonasActivas` existente), usado para decidir si el país queda bloqueado (research.md Decisión 3).

## Flujo de datos: crear zona desde la pestaña de un transportista

```text
SeccionZonasTarifas (recibe transportista.paisId + transportista.pais)
  └─ DialogZonaEntrega (paisId fijo, no editable)
       └─ ubicaciones[].paisId = transportista.paisId (no se renderiza selector de país)
       └─ ubicaciones[].provinciaEstado → SelectorEstadoProvincia(paisId=transportista.paisId)
```

`CrearZonaEntregaSchema`/`EditarZonaEntregaSchema` (spec 022) no cambian — siguen aceptando `ubicaciones[].paisId` como string; lo único que cambia es que el valor llega fijo desde el transportista en vez de un `<Select>` libre, y que la Server Action `crearZonaEntrega`/`editarZonaEntrega` no necesita cambios porque el país sigue siendo un campo normal de `ZonaEntregaUbicacion`.

## Backfill (`scripts/backfill-pais-transportista.ts`)

No es un modelo, es un script de datos (research.md Decisión 4). Pseudocódigo de la consulta central:

```text
para cada Transportista con paisId = NULL:
  paisesDistintos = SELECT DISTINCT zeu.paisId
                    FROM TarifaTransportistaZona ttz
                    JOIN ZonaEntrega ze ON ze.id = ttz.zonaEntregaId
                    JOIN ZonaEntregaUbicacion zeu ON zeu.zonaEntregaId = ze.id
                    WHERE ttz.transportistaId = <id>
  si length(paisesDistintos) == 1: UPDATE Transportista SET paisId = paisesDistintos[0]
  si no: dejar paisId = NULL (queda "país pendiente")
```
