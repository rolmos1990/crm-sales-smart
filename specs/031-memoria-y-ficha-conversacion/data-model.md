# Data Model: Memoria conversacional y ficha de conversación

**Feature**: `031-memoria-y-ficha-conversacion` | **Fecha**: 2026-11-14

---

## 1. Configuración del nodo (sin tabla — vive en el JSON del Workflow)

Se agrega a `ConfigAtencionIASchema` en `src/workflows/definicion/schema.ts`.
Viaja dentro de `Workflow.borrador` y `WorkflowVersion.definicion`.

| Campo | Tipo | Reglas | Ausente significa |
|---|---|---|---|
| `memoria` | objeto opcional | — | Comportamiento previo a esta feature: la cantidad la decide el presupuesto de tokens (FR-002) |
| `memoria.activa` | boolean | default `true` | — |
| `memoria.cantidad` | entero | `1 ≤ n ≤ 30`, default `10` | — |
| `ficha` | objeto opcional | — | El nodo no registra ni usa ficha (FR-010) |
| `ficha.activa` | boolean | default `false` | — |

**Invariante de retrocompatibilidad**: ambos campos son `.optional()` **sin**
default de objeto. Reparsear la configuración de un nodo ya publicado debe
dejarlos en `undefined`, nunca materializarlos. Ver research D4.

**Validación de publicación**: `CONFIG_POR_TIPO.ATENCION_IA` ya se aplica en
`src/workflows/definicion/validador.ts`; una `cantidad` fuera de rango bloquea la
publicación sin código nuevo (FR-008).

---

## 2. `FichaConversacionIA` (tabla nueva)

Una fila por conversación. Modelada sobre `PerfilClienteSnapshot` (spec 012).

```prisma
model FichaConversacionIA {
  id            String   @id @default(cuid())
  hechos        Json
  interpretado  Json?
  turnos        Int      @default(0)
  actualizadoEn DateTime @default(now()) @updatedAt

  conversacionId String       @unique
  conversacion   Conversacion @relation(fields: [conversacionId], references: [id], onDelete: Cascade)

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  @@index([instanciaId])
}
```

| Decisión | Por qué |
|---|---|
| `conversacionId @unique` | 1-1. FR-015: la ficha es de la conversación, no del contacto |
| `onDelete: Cascade` | Borrada la conversación, la ficha no tiene sentido |
| `instanciaId` explícito | FR-033: toda query va acotada al tenant sin tener que hacer join |
| `turnos` como columna | Es el único campo que se consulta/ordena; el resto es contenido de prompt |
| Sin campo `vigente` | Se deriva comparando `actualizadoEn` con `Conversacion.atencionDesde` (research D14) |

**Migración**: `prisma/migrations/<timestamp>_ficha_conversacion_ia/` — aditiva,
una tabla nueva y una relación inversa en `Conversacion` e `Instancia`. Sin
backfill: la ausencia de fila es un estado válido y significa "todavía no hay
ficha".

---

## 3. `hechos` (JSON) — derivado de datos verificables

Tipos en `src/ai/ficha-conversacion/tipos.ts`.

```ts
interface HechosConversacion {
  productoEnFoco: { productoId: string; nombre: string } | null;
  ultimoPrecioInformado: {
    productoId: string | null;   // null cuando es el total de un documento
    nombre: string;
    monto: number;
    moneda: string;
    origen: "CONSULTA_PRECIO" | "BUSQUEDA" | "COTIZACION" | "PEDIDO";
    mensajeId: string;
    informadoEn: string;         // ISO UTC
  } | null;
  ultimaPreguntaDelAgente: {
    texto: string;
    mensajeId: string;
    hechaEn: string;             // ISO UTC
    turnosDesde: number;
  } | null;
  documentos: Array<{
    tipo: "COTIZACION" | "PEDIDO";
    id: string;
    numero: string;
    total: number;
    moneda: string;
    creadoEn: string;            // ISO UTC
  }>;
  ultimoTurnoEn: string;         // ISO UTC
}
```

### Reglas de derivación

| Campo | Regla | Research |
|---|---|---|
| `productoEnFoco` | args de `consultar_precio_actual`/`consultar_disponibilidad` → producto del documento creado → primer resultado de `buscar_productos`. Sin señal en el turno, se conserva el anterior | D8 |
| `ultimoPrecioInformado` | Vino de una herramienta **y** su monto aparece en el texto enviado. Si ningún precio pasa el filtro, se conserva el anterior | D6 |
| `ultimaPreguntaDelAgente` | Última oración terminada en `?` del mensaje enviado. `turnosDesde` se incrementa cada turno; se reemplaza cuando el agente hace una pregunta nueva. **No se intenta decidir si fue respondida** | D7 |
| `documentos` | Resultado `ok` de `crear_cotizacion` / `crear_pedido`. Acumulativo, sin tope (una conversación no genera decenas) | — |

Todas las fechas en UTC, en ISO (`CLAUDE.md` regla 7). Son contenido de prompt;
se formatean para el modelo en la zona de negocio en el momento de armar la capa.

---

## 4. `interpretado` (JSON) — derivado por IA, puede estar equivocado

```ts
interface LecturaConversacion {
  tema: string | null;
  intencion: IntencionComercial | null;   // enum existente, NO uno nuevo (FR-021)
  datosConocidos: Record<string, string>;
  datosFaltantes: string[];
  resumen: string | null;
  confianza: number;                      // 0..1
  derivadoEn: string;                     // ISO UTC
}
```

- `IntencionComercial` se importa de `src/ai/estrategia/tipos.ts`. FR-021
  prohíbe un vocabulario paralelo de etapas de compra.
- Nunca se borra: si la derivación falla o el JSON no parsea, se conserva la
  lectura anterior (FR-023). Es la misma regla que `datosInterpretados` en la
  spec 012.
- Truncados antes de entrar al prompt: `resumen` 500 caracteres, cada valor de
  `datosConocidos` 200, cada ítem de `datosFaltantes` 200 (research D15).

### Correspondencia con la propuesta original del negocio

| Propuesta | Dónde queda | Nota |
|---|---|---|
| `topic` | `interpretado.tema` | — |
| `productId` | `hechos.productoEnFoco.productoId` | pasa a hecho verificable, no interpretación |
| `customerIntent` | `interpretado.intencion` | usa el enum existente |
| `purchaseStage` | — | **no se crea**: la etapa real es `Oportunidad.etapa` y la intención ya la cubre `IntencionComercial` (FR-021) |
| `knownFacts` | `interpretado.datosConocidos` | — |
| `openQuestion` | `hechos.ultimaPreguntaDelAgente` | pasa a hecho verificable |
| `lastPriceShown` | `hechos.ultimoPrecioInformado` | con la regla de doble condición de D6 |
| `summary` | `interpretado.resumen` | — |

---

## 5. Relaciones y alcance

```
Instancia ──┬─< Conversacion ──1:1── FichaConversacionIA
            └─< PerfilClienteSnapshot >── Contacto        (spec 012, NO se toca)
```

| | `FichaConversacionIA` (031) | `PerfilClienteSnapshot` (012) |
|---|---|---|
| Alcance | Una conversación | Un contacto |
| Cadencia | Cada turno de IA | Eventos de dominio |
| Vida | Mientras dura la conversación | Permanente |
| Capas | 6 y 7 | 5 |

Son independientes por FR-015. Un contacto con tres conversaciones abiertas
tiene un perfil y tres fichas.

---

## 6. Transiciones de estado de la ficha

| Desde | Evento | Hacia |
|---|---|---|
| (no existe) | Primer turno de IA con `ficha.activa` | `hechos` escritos, `interpretado` null |
| vigente | Turno de IA | `hechos` actualizados, `interpretado` actualizado si la derivación tuvo éxito |
| vigente | Turno de IA, derivación falla | `hechos` actualizados, `interpretado` **intacto** (FR-023) |
| vigente | Turno sin envío (`accion !== ENVIADO`) | **sin cambios** (research D9) |
| vigente | Un humano toma la conversación | Queda implícitamente no vigente: `actualizadoEn < atencionDesde` ⇒ la capa 6 la omite (FR-016, research D14) |
| no vigente | Vuelve la atención automática | Se reescribe en el turno siguiente y vuelve a usarse |
| cualquiera | Se borra la conversación | Se borra en cascada |
