# Contrato: Server Actions y queries (041)

Todas las acciones: `'use server'`, sesión obligatoria, `instanciaId` **siempre** de la sesión (nunca del input), validación Zod al inicio, errores genéricos al cliente (`{ ok: false, error: string }` sin detalles internos). Los tipos se derivan de los esquemas con `z.infer<>`.

## 1. `consultarVistaContactosAction(filtros)` — lista + indicadores

**Archivo**: `src/crm/contactos/actions.ts` → delega en `cargarVistaContactos` (`src/crm/contactos/vista.ts`).
**Permiso**: `contactos` lectura.

```ts
const FiltrosVistaContactosSchema = z.object({
  pagina: z.number().int().min(1).default(1),
  tamanoPagina: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(50),
  orden: z.enum(["PRIORIDAD", "NOMBRE", "ULTIMA_ACTIVIDAD", "INTERES"]).default("PRIORIDAD"),
  direccion: z.enum(["asc", "desc"]).optional(),          // ignorado para PRIORIDAD
  segmento: z.enum(["TODOS", "CLIENTES", "INTERESADOS", "POR_RECUPERAR", "LEADS"]).default("TODOS"),
  busqueda: z.string().trim().max(100).default(""),
  tipo: z.enum(["CLIENTE", "INTERESADO", "LEAD"]).optional(),
  interes: z.enum(["ALTO", "MEDIO", "BAJO", "SIN_EVALUAR"]).optional(),
  canal: z.enum(["WHATSAPP", "INSTAGRAM", "FACEBOOK_MESSENGER", "EMAIL"]).optional(),
  ultimaActividad: z.enum(["HOY", "ULTIMOS_7", "ULTIMOS_30", "MAS_DE_30", "SIN_ACTIVIDAD"]).optional(),
  seguimiento: z.enum(["AL_DIA", "PENDIENTE", "POR_RECUPERAR", "INACTIVO"]).optional(),
  preferencia: z.enum(["CONTACTABLE", "NO_CONTACTAR"]).optional(),
});
```

**Respuesta** (`VistaContactos`):

```ts
{
  indicadores: { total: number; clientes: number; interesados: number; porRecuperar: number; leads: number }; // sin filtros de barra (research D7)
  filas: Array<{
    id: string;
    nombre: string; apellido: string; avatarUrl: string | null;
    datoSecundario: string | null;            // teléfono principal, o email si no hay teléfono
    tipo: "CLIENTE" | "INTERESADO" | "LEAD";   // tipo principal
    esInteresado: boolean;                      // true también para un Cliente interesado
    interes: "ALTO" | "MEDIO" | "BAJO" | "SIN_EVALUAR";
    interesFijado: boolean;
    noContactar: boolean;
    ultimaInteraccionEn: string | null;        // ISO UTC; se formatea con <FechaHora>
    canal: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK_MESSENGER" | "EMAIL" | null;
    seguimiento: "AL_DIA" | "PENDIENTE" | "POR_RECUPERAR" | "INACTIVO";
    recomendacion: "NO_CONTACTAR" | "RESPONDER" | "RETOMAR_CONVERSACION" | "CONTACTAR_HOY"
                 | "DAR_SEGUIMIENTO" | "OFRECER_NOVEDADES" | "EVALUAR" | "SIN_URGENCIA";
  }>;
  total: number;            // contactos que cumplen segmento + filtros
  pagina: number; tamanoPagina: number;
  hayFiltrosActivos: boolean;
}
```

Reglas: `segmento` y `tipo` se combinan con AND (seleccionar el indicador "Clientes" fija `segmento`; el filtro Tipo es independiente). Una `pagina` mayor que la última devuelve la última página. El tipo, el seguimiento y la recomendación de cada fila se calculan con las mismas condiciones que los filtros (research D1), no con una lógica paralela en el cliente.

## 2. `obtenerResumenContactoAction(contactoId)` — panel lateral

**Permiso**: `contactos` lectura. Contacto de otra instancia o inexistente → `{ ok: false, error: "Contacto no encontrado" }`.

```ts
{
  ok: true;
  contacto: {
    id; nombre; apellido; email; telefonoPrincipal; telefonoSecundario; avatarUrl;
    empresa: { id; nombre } | null;
    etiquetas: Array<{ id; nombre; color }>;
    canales: Array<{ canal; identificador; handle: string | null }>;
    tipo; esInteresado; interes; interesOrigen: "MANUAL" | "REGLA" | "IA" | null; interesFijado;
    noContactar: { desde: string; origen; porNombre: string | null } | null;
    seguimiento; recomendacion;
  };
  actividadComercial: {
    ultimaCompra: { pedidoId; numero; fecha: string } | null;   // pedido con condición de venta más reciente
    oportunidadesAbiertas: Array<{ id; titulo; etapa }>;         // máx. 5
    actividadesPendientes: Array<{ id; titulo; fecha: string; vencida: boolean }>; // máx. 5
    ultimaInteraccionEn: string | null;
    conversacionMasRecienteId: string | null;                    // para "Abrir conversación"
  };
  historial: Array<{ dimension; valorAnterior; valorNuevo; origen; usuarioNombre: string | null; creadoEn: string }>; // últimos 10
}
```

## 3. `actualizarInteresContactoAction(input)`

**Permiso**: `contactos` modificación.

```ts
z.object({
  contactoId: z.string().cuid(),
  accion: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("FIJAR"), nivel: z.enum(["ALTO", "MEDIO", "BAJO", "SIN_EVALUAR"]) }),
    z.object({ tipo: z.literal("LIBERAR") }),
  ]),
})
```

Efecto (transacción): actualiza `nivelInteres`, `nivelInteresOrigen = MANUAL`, `nivelInteresFijado` (`true` al fijar, `false` al liberar, con nivel `SIN_EVALUAR`), `nivelInteresActualizadoEn`; inserta historial. Después del commit: evento `ContactoInteresActualizado`, `revalidatePath("/crm/contactos")` y `revalidatePath("/crm/contactos/[id]", "page")`. Si el valor no cambia, no escribe nada y responde `ok: true`.

## 4. `actualizarPreferenciaContactoAction(input)`

**Permiso**: `contactos` modificación.

```ts
z.object({ contactoId: z.string().cuid(), noContactar: z.boolean() })
```

Efecto: `noContactarDesde = ahora | null`, `noContactarOrigen = MANUAL | null`, `noContactarPorId = sesión | null`; historial; evento `ContactoPreferenciaContactoActualizada`; mismos `revalidatePath` + `revalidatePath("/inbox")`.

La función de servicio subyacente (`src/crm/contactos/clasificacion.ts`) acepta `origen` para uso interno (042), y **rechaza** pasar de No contactar a Contactable con `origen ≠ MANUAL`. Esa regla vive en el servicio, no en la acción, para que ningún llamador automático pueda saltarla.

## 5. `guardarUmbralesSeguimientoAction(input)`

**Archivo**: `src/configuracion/empresa/actions.ts` (junto a `guardarPreferenciaCatalogoVenta`). **Permiso**: `configuracion` modificación.

```ts
z.object({
  diasSeguimientoPendiente: z.number().int().min(1),
  diasSeguimientoRecuperar: z.number().int(),
  diasSeguimientoInactivo: z.number().int().max(3650),
}).refine(v => v.diasSeguimientoPendiente < v.diasSeguimientoRecuperar
            && v.diasSeguimientoRecuperar <= v.diasSeguimientoInactivo,
          { message: "Los días deben cumplir Pendiente < Por recuperar ≤ Inactivo" })
```

UI: sección "Seguimiento de contactos" en `src/configuracion/components/tab-preferencias.tsx`. `revalidatePath("/configuracion")` y `revalidatePath("/crm/contactos")`.

## 6. Cambio de firma interna: `enviarMensajeInterno`

**Archivo**: `src/conversaciones/envio.ts`.

```ts
interface EnviarMensajeInternoInput {
  // …campos actuales…
  /** Reemplaza a `origen?: "WORKFLOW"`. Obligatorio: cada llamador declara quién escribe. */
  autor: "PERSONA" | "IA" | "WORKFLOW";
}
```

| Llamador | `autor` | `usuarioId` |
|---|---|---|
| `conversaciones/actions.ts` `enviarMensaje` | `PERSONA` | de la sesión (ya no del input) |
| `ai/respuesta/responder-con-agente.ts` | `IA`, o `WORKFLOW` si `params.origen.tipo === "WORKFLOW"` | — |
| `workflows/motor/adaptadores.ts` | `WORKFLOW` | — |
| `ai/autonomia/actions.ts` (aprobación en modo Workflow) | `WORKFLOW` | — |

Comportamiento nuevo, antes de crear el mensaje: si el contacto tiene `noContactarDesde` y `autor !== "PERSONA"` → `{ ok: false, error: MENSAJE_NO_CONTACTAR }` (constante exportada). `adaptadores.enviarMensaje` convierte ese error en `ErrorDefinitivoWorkflow` (sin reintentos).

Después de crear el mensaje (no nota interna): `registrarRespuesta(contactoId)` siempre; `registrarInteraccion(contactoId, ahora)` solo con `autor === "PERSONA"`. `procesarPrimeraRespuestaProspecto` se sigue llamando cuando `autor !== "WORKFLOW"` (equivale al `origen !== "WORKFLOW"` actual).

## 7. Queries que no cambian (FR-036)

`obtenerContactos` (usada por `src/app/crm/pipeline/page.tsx`) y `buscarContactos` (selectores de Pedidos, Cotizaciones, Actividades) conservan firma y resultado. La página de Contactos deja de usar `obtenerContactos`.
