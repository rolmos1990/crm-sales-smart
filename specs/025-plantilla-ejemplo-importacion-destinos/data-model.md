# Data Model: Plantilla de ejemplo para importar destinos y tarifas

No hay entidades persistentes nuevas — esta feature no toca Prisma ni la base de datos (ver Constitution Check en `plan.md`, principios II/III N/A). El único "modelo de datos" es la forma en memoria de la plantilla generada, derivada de constantes de dominio ya existentes en `src/sales/transportistas/importacion-destinos/types.ts`.

## PlantillaEjemploDestinos (conceptual, no persistido)

Forma que produce la función pura `construirPlantillaEjemploDestinos()` (`utils/plantilla-ejemplo-destinos.ts`), consumida luego por los wrappers de descarga (CSV/Excel):

| Campo | Tipo | Descripción |
|---|---|---|
| `encabezados` | `string[]` | Una entrada por cada `ColumnaDestino` de `COLUMNAS_DESTINO`, en el mismo orden, tomando el texto de `ETIQUETAS_COLUMNA_DESTINO`; las columnas presentes en `COLUMNAS_DESTINO_REQUERIDAS` llevan el sufijo `" *"` (ver research.md Decisión 4). |
| `filaEjemplo` | `string[]` | Un valor de ejemplo por columna, en el mismo orden que `encabezados`, con los matices de formato descritos en research.md Decisión 3 (alias múltiples separados por `;`, números sin símbolo de moneda, días como enteros). |

No lleva `id`, no se guarda en ningún store, no tiene relaciones con otras entidades del dominio (`ZonaEntrega`, `ZonaEntregaUbicacion`, `TarifaTransportistaZona`, etc.) — es puramente derivada de las constantes ya existentes y se recalcula en cada descarga.

### Reglas de validación / invariantes

- `encabezados.length === filaEjemplo.length === COLUMNAS_DESTINO.length` (11 columnas) — invariante que el test unitario de `plantilla-ejemplo-destinos.test.ts` verifica explícitamente, para detectar si alguien agrega una columna a `COLUMNAS_DESTINO` sin actualizar el valor de ejemplo correspondiente.
- Cada columna en `COLUMNAS_DESTINO_REQUERIDAS` MUST aparecer en `encabezados` con el sufijo `" *"` — invariante que el test verifica recorriendo `COLUMNAS_DESTINO_REQUERIDAS`.
- Ningún valor de `filaEjemplo` MUST provenir de datos reales de un transportista/tenant (FR-007) — no aplica una validación en runtime (no hay input de usuario acá), se garantiza por revisión de código: los valores son literales hardcodeados en la función.

## Salidas derivadas (no son "modelos" nuevos, son formatos de exportación de lo anterior)

- **CSV**: texto plano (`encabezados` unidos por `,`, luego `filaEjemplo` unida por `,`, celdas escapadas si contienen `,`/`"`/salto de línea), con BOM UTF-8 al inicio — igual criterio que `exportarPedidosCsv()`.
- **Excel (.xlsx)**: una única hoja (`XLSX.utils.aoa_to_sheet([encabezados, filaEjemplo])`), sin fórmulas ni estilos adicionales.

Ninguno de los dos formatos de salida requiere un esquema Zod propio — no hay boundary de servidor que valide esta plantilla (se genera y descarga enteramente en el cliente); el esquema Zod que sí existe (`FilaDestinoImportSchema` en `schema.ts`) sigue aplicando del lado de la *re-subida* del archivo completado por el usuario, sin cambios.
