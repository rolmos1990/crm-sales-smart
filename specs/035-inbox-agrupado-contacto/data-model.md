# Data Model: Inbox agrupado por contacto

**Feature**: 035-inbox-agrupado-contacto | **Fecha**: 2026-11-16

## Cambios en la base de datos

**Ninguno.** Sin migración, sin modelos nuevos, sin columnas nuevas, sin escrituras. Las entidades
persistidas que la feature consume ya existen tal cual:

| Modelo Prisma | Rol en esta feature | Se modifica |
|---|---|---|
| `Contacto` | la persona que agrupa | No |
| `Conversacion` | el hilo que se abre y se responde | No |
| `ContactoIdentificadorCanal` | las identidades que se listan en el panel | No |
| `CuentaCanal` | el canal que etiqueta cada conversación | No |
| `MensajeConversacion` | el último mensaje que define "no leído" y la hora | No |

---

## Cambios en los tipos de transporte

### `ContactoResumen` (`src/conversaciones/types.ts`) — MODIFICADO

Gana el arreglo de identidades que hoy se descarta en el mapeo. Es el único cambio de forma en los datos
que viajan del servidor al cliente.

```ts
export interface IdentidadCanalResumen {
  canal: string;              // "whatsapp_lite" | "instagram" | "email" | "facebook_messenger" | …
  identificador: string;      // número, dirección de correo o id externo del canal
  handle: string | null;      // @usuario visible, si el canal lo expone (Instagram)
}

export interface ContactoResumen {
  // … campos actuales, sin cambios …
  /** 035 — Todas las identidades de canal registradas del contacto. Ya venían
   *  en el `select` de `contactoSelect` y se descartaban al mapear. */
  identificadoresCanal: IdentidadCanalResumen[];
}
```

**Regla de llenado** (`mapearConversacion`, `src/conversaciones/queries.ts`): se copia el arreglo completo
que ya devuelve Prisma. Los campos `identificadorCanal` y `handleCanal` que hoy se derivan del canal activo
**se conservan**: los usa la lista y el panel actual, y quitarlos sería una regresión gratuita.

**Costo**: cero consultas nuevas; el `select` no cambia. Crece la serialización por conversación en
proporción a la cantidad de identidades del contacto (típicamente 1 a 3 entradas cortas).

**Aislamiento de tenant**: las identidades vienen de `contacto.identificadoresCanal` dentro de una consulta
que ya filtra por `instanciaId` de la sesión. No se agrega ninguna vía de acceso nueva.

---

## Modelo derivado (solo en memoria, solo en el cliente)

Nada de esto se persiste ni se envía al servidor. Se recalcula a partir del arreglo de conversaciones que
`InboxLayout` ya tiene en estado, en el mismo `useMemo` donde hoy se filtra y ordena.

### `GrupoContacto`

Una persona con las conversaciones suyas que pasan el filtro activo.

```ts
export interface GrupoContacto {
  contactoId: string;
  contacto: ContactoResumen;          // tomado de la conversación líder
  conversaciones: ConversacionResumen[];  // solo las visibles bajo el filtro/búsqueda, ya ordenadas
  lider: ConversacionResumen;         // la más prioritaria; define orden, estado y datos del colapsado
  /** Cantidad de conversaciones VISIBLES (no el total del contacto) — ver research.md, Decisión 3. */
  totalConversaciones: number;
  /** Canales distintos entre las conversaciones visibles. */
  totalCanales: number;
  /** Suma de conversaciones visibles con mensajes del contacto sin leer. */
  noLeidos: number;
  /** Alguna conversación visible requiere atención humana. */
  requiereAtencionHumana: boolean;
  /** true cuando `conversaciones.length === 1` → se renderiza como fila simple (FR-004). */
  esSimple: boolean;
}
```

**Reglas de derivación**:

- **Clave de agrupación**: `conversacion.contactoId`. No hay agrupación por identidad ni por persona real:
  dos contactos distintos de la misma persona siguen siendo dos grupos (Assumptions del spec).
- **Líder**: la conversación de menor `PRIORIDAD[estado]`; a igual prioridad, la de `actualizadoEn` más
  reciente.
- **Orden interno de las conversaciones**: el mismo criterio que el líder, aplicado a todas.
- **`noLeidos`**: cuenta las conversaciones cuyo `ultimoMensaje` es `remitente === "CONTACTO"` y
  `estado !== "LEIDO"` — el mismo predicado que usa la lista actual.
- **`requiereAtencionHumana`**: `cuentaParaAtencionHumana(conv)` sobre alguna conversación visible, para no
  duplicar el criterio que ya vive en `src/conversaciones/atencion-humana.ts`.
- **Transitoriedad**: el grupo se reconstruye entero en cada refresco (SSE o auto-refresco de 30s). Ningún
  estado de interacción vive adentro — ver `EstadoExpansion`.

### `AvisoOtroCanal`

Lo que el chat abierto debe mostrar, o `null` si no hay nada que avisar.

```ts
export interface AvisoOtroCanal {
  conversacionId: string;   // la OTRA conversación, a la que se salta
  canal: string;            // canal de esa conversación (para ícono y texto)
  nombreCanal: string;      // nombre de la cuenta, tal como lo muestra la lista
  mensajeId: string;        // id del mensaje que motiva el aviso — clave del descarte
  fecha: Date;              // cuándo escribió, para el "hace N h"
}
```

**Reglas de derivación**:

- Solo se consideran conversaciones **del mismo `contactoId`**, distintas de la abierta, **ya cargadas** en
  el Inbox (FR-015).
- La candidata debe tener `ultimoMensaje` del contacto, no leído, y con `creadoEn` **posterior** al
  `creadoEn` del último mensaje de la conversación abierta.
- Si hay varias candidatas, gana la más reciente.
- Si su `mensajeId` está en el conjunto de descartados, el resultado es `null`.

### `EstadoExpansion`

```ts
// Conjunto de contactoId COLAPSADOS. Ausencia = expandido (default).
type EstadoExpansion = Set<string>;
```

Vive en un `useState` de `InboxLayout`, fuera del arreglo de datos, para sobrevivir al reemplazo completo
que hace el auto-refresco (research.md, Decisión 4).

### `AvisosDescartados`

```ts
// Conjunto de mensajeId cuyo aviso el agente ya descartó en esta sesión.
type AvisosDescartados = Set<string>;
```

Efímero por decisión de alcance: no se persiste (Assumptions del spec). Se descarta por **mensaje**, no por
conversación, para que un mensaje nuevo del mismo canal vuelva a avisar (research.md, Decisión 5).

---

## Transiciones de estado

La feature **no introduce ninguna**. Los estados de `Conversacion` (`ABIERTA`, `EN_ESPERA`, `CERRADA`,
`ARCHIVADA`) y el modo de atención siguen cambiando exclusivamente por las acciones existentes del Inbox,
con su validación y autorización actuales. El modelo derivado es de solo lectura sobre el resultado de esas
transiciones.
