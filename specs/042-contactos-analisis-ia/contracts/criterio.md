# Contrato: contenido del criterio de análisis

Esquema Zod en `src/crm/contactos/analisis/criterio/schema.ts`. Valida
`CriterioAnalisisContactosVersion.contenido` al guardar y al publicar.

```ts
CriterioContenido = {
  instrucciones: string,          // 0–2.000 caracteres, sin etiquetas <criterio_negocio> ni <datos_lote>
  senalesCompra: string[],        // 0–15, cada una de 3 a 120 caracteres
  objecionesTipicas: string[],    // 0–15, cada una de 3 a 120 caracteres
  umbrales: {
    comprasRecurrente: number,    // entero 2–50, por defecto 2
    diasInactivo: number,         // entero 15–730, por defecto 90
  },
  pesos: {                        // cada uno entre 0 y 1; suma = 1 (±0,001)
    compras: number,              // por defecto 0,30
    recencia: number,             // por defecto 0,25
    documentosAbiertos: number,   // por defecto 0,20
    actividadAgendada: number,    // por defecto 0,10
    esperaRespuesta: number,      // por defecto 0,15
  },
}
```

## Plantillas por rubro (`criterio/plantillas.ts`)

| Clave | Nombre | Diferencias respecto de General |
|---|---|---|
| `GENERAL` | General | Valores por defecto. Señales: consulta precio, pide disponibilidad, pregunta formas de pago o envío |
| `RETAIL` | Comercio minorista | Recurrente desde 3 compras; inactivo a los 60 días; más peso en recencia. Señales: talle o color, stock, envío |
| `SERVICIOS` | Servicios / citas | Inactivo a los 120 días; más peso en actividad agendada. Señales: pide turno o agenda, consulta horarios |
| `B2B` | Venta B2B | Inactivo a los 180 días; más peso en documentos abiertos. Señales: pide cotización formal, volumen, condiciones de crédito; objeciones: aprobación interna, presupuesto |

## Reglas

- Una cuenta sin criterio usa `GENERAL` en memoria (research D12).
- "Usar plantilla" crea un BORRADOR copiando la plantilla. El administrador
  edita y publica.
- Al publicar:
  - `numero = max + 1`.
  - La versión publicada anterior pasa a ARCHIVADA.
  - `CriterioAnalisisContactos.versionPublicadaId` apunta a la nueva.
- "Reevaluar con el nuevo criterio" es opcional. Marca P2 con
  `motivo = CRITERIO` y `tipo = REEVALUACION` a todos los contactos de la
  cuenta (Historia 3, escenario 7).
