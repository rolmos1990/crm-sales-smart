# Contrato: módulo de agrupación del Inbox

**Archivo**: `src/conversaciones/agrupacion.ts`
**Tests**: `src/conversaciones/agrupacion.test.ts` (Vitest, `environment: node`)

Esta feature no expone ninguna interfaz externa nueva: no hay endpoints, ni server actions, ni eventos de
dominio, ni contratos con proveedores. La única superficie que vale la pena fijar por contrato es la del
módulo puro donde vive toda la lógica — es lo que consumen los componentes y lo que prueban los tests.

**Restricciones del módulo** (son parte del contrato, no recomendaciones):

- No importa React ni nada de `src/components/`.
- No importa Prisma, ni `src/shared/db`, ni ninguna server action.
- No lee `window`, `localStorage` ni `Date.now()` implícito: el "ahora" se recibe por parámetro cuando hace
  falta.
- Todas las funciones son puras: mismos argumentos → mismo resultado, sin efectos.

---

## `agruparPorContacto`

```ts
export function agruparPorContacto(
  conversaciones: ConversacionResumen[],
): GrupoContacto[]
```

Agrupa por `contactoId` y devuelve los grupos **ya ordenados** con el criterio vigente del Inbox
(`PRIORIDAD[estado]`, desempate por `actualizadoEn` descendente) aplicado a la conversación líder de cada
grupo. Las conversaciones dentro de cada grupo quedan ordenadas con el mismo criterio.

**Entrada**: la lista **ya filtrada y buscada**. El módulo no filtra: recibe lo que debe mostrarse. Eso es
lo que hace que `totalConversaciones` cuente hijos visibles (research.md, Decisión 3) sin que la función
necesite conocer el filtro activo.

**Garantías**:

| Garantía | Detalle |
|---|---|
| Cobertura total | Toda conversación de la entrada aparece exactamente en un grupo. |
| Sin grupos vacíos | Cada grupo tiene al menos una conversación. |
| `esSimple` | `true` si y solo si el grupo tiene exactamente una conversación. |
| `totalCanales` | Canales distintos (por `cuentaCanal.canal`) entre las conversaciones del grupo; una conversación sin cuenta de canal no suma. |
| `noLeidos` | Cantidad de conversaciones del grupo cuyo último mensaje es del contacto y no está leído. |
| `requiereAtencionHumana` | `true` si alguna conversación del grupo lo requiere, según `cuentaParaAtencionHumana`. |
| Estabilidad | Entrada vacía → `[]`. El orden es determinista: no depende del orden de iteración de un `Map` para desempatar. |

---

## `elegirAvisoOtroCanal`

```ts
export function elegirAvisoOtroCanal(args: {
  conversacionAbierta: ConversacionResumen;
  todasLasConversaciones: ConversacionResumen[];
  descartados: ReadonlySet<string>;
}): AvisoOtroCanal | null
```

Decide si el chat abierto debe mostrar el aviso de otro canal, y cuál.

**Reglas** (en orden de evaluación):

1. Candidatas: conversaciones de `todasLasConversaciones` con el mismo `contactoId` y distinto `id` que la
   abierta. Nunca se consulta nada fuera de este arreglo (FR-015).
2. Cada candidata debe tener `ultimoMensaje` con `remitente === "CONTACTO"` y `estado !== "LEIDO"`.
3. Su `ultimoMensaje.creadoEn` debe ser **estrictamente posterior** al `creadoEn` del último mensaje de la
   conversación abierta. Si la abierta no tiene mensajes, cualquier candidata no leída califica.
4. Si quedan varias, gana la de `creadoEn` más reciente.
5. Si el `mensajeId` de la ganadora está en `descartados`, devuelve `null` (no se busca la siguiente: el
   agente descartó el aviso más nuevo, mostrarle uno más viejo sería ruido).

**Devuelve** `null` cuando no hay candidata que cumpla, cuando la conversación abierta no tiene contacto
resoluble, o cuando el aviso ganador está descartado.

---

## `resumirIdentidades`

```ts
export function resumirIdentidades(args: {
  identidades: IdentidadCanalResumen[];
  conversacionesDelContacto: ConversacionResumen[];
}): IdentidadConAcceso[]
```

```ts
export interface IdentidadConAcceso extends IdentidadCanalResumen {
  /** Conversación cargada en el Inbox para esa identidad, si existe. */
  conversacionId: string | null;
  /** Última actividad conocida, solo si hay conversación cargada. */
  ultimaActividad: Date | null;
}
```

Empareja cada identidad con la conversación del contacto que corre por ese canal, **solo entre las
conversaciones ya cargadas**. Una identidad sin conversación cargada se devuelve con
`conversacionId: null` y `ultimaActividad: null` — se muestra como canal registrado, sin acción de apertura
(FR-018). No se dispara ninguna consulta para completarla.

**Emparejamiento**: por `canal`. Si varias conversaciones del contacto comparten canal (caso del correo
agrupado por hilo), gana la de `actualizadoEn` más reciente.

**Orden**: canales con conversación cargada primero, ordenados por `ultimaActividad` descendente; después
los canales sin conversación, en orden estable de entrada.

---

## Contrato de presentación (componentes)

No se formaliza como código, pero estos dos puntos son verificables y están atados a requisitos del spec:

| Elemento | Contrato | Requisito |
|---|---|---|
| Fila de persona | `data-testid="grupo-contacto"` | research.md, Decisión 8 |
| Conversación dentro del grupo | `data-testid="conversacion-item"` | research.md, Decisión 8 |
| Canal del chat abierto | elemento **no interactivo** (sin `button`, sin menú) | FR-020 |
| Contadores de las pestañas de filtro | siguen contando conversaciones | FR-008 |
