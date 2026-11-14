# Contrato: configuración del nodo "Atención IA"

**Feature**: `031-memoria-y-ficha-conversacion`

Contrato de UI y de datos para los controles nuevos del panel de propiedades
del nodo. Archivo: `src/workflows/components/editor/formularios-nodo.tsx`
(`FormAtencionIA`).

---

## Controles

Se insertan **después** de "Instrucciones adicionales" y **antes** del bloque
condicional de modo `CONTINUA`, para que apliquen a los dos modos.

### 1. Memoria

| | |
|---|---|
| **Etiqueta** | `Leer mensajes anteriores` |
| **Control** | `<Switch>` |
| **Ayuda** | `El agente entra a cada turno viendo lo que ya se habló.` |
| **Estado inicial de un nodo nuevo** | Apagado, y la clave `memoria` **no existe** en la configuración |

Con el switch encendido aparece:

| | |
|---|---|
| **Etiqueta** | `Cuántos recordar` |
| **Control** | `<Input type="number">`, ancho `w-24` (igual que "Máximo de mensajes de la IA") |
| **Rango** | 1 a 30 |
| **Valor al encender** | 10 |
| **Ayuda** | `Los últimos mensajes de la conversación, del cliente y del agente.` |

**Transiciones de la clave `memoria`** — esto es lo que garantiza FR-002:

| Acción del usuario | Resultado en la configuración |
|---|---|
| No toca nada | `memoria` ausente |
| Enciende el switch | `memoria = { activa: true, cantidad: 10 }` |
| Cambia la cantidad a N | `memoria = { activa: true, cantidad: N }` |
| Apaga el switch | `memoria = { activa: false, cantidad: <la última elegida> }` |

> Apagar el switch **no** borra la clave: `{ activa: false }` es un estado
> distinto de "ausente". Ausente = presupuesto de tokens (legacy); `false` =
> solo el último mensaje del cliente.

### 2. Ficha

| | |
|---|---|
| **Etiqueta** | `Recordar en qué va la conversación` |
| **Control** | `<Switch>` |
| **Ayuda** | `El agente ve qué producto se habló, qué precio ya informó y qué dejó preguntado.` |
| **Estado inicial de un nodo nuevo** | Apagado, clave `ficha` **ausente** |
| **Al encender** | `ficha = { activa: true }` |
| **Al apagar** | `ficha = { activa: false }` |

---

## Esquema (`src/workflows/definicion/schema.ts`)

```ts
export const ConfigAtencionIASchema = z.object({
  // ... campos existentes, sin tocar ...

  // 031 — memoria conversacional. Ausente = comportamiento previo a esta
  // feature (la cantidad la decide el presupuesto de tokens del agente).
  // NO lleva .default({}): materializarlo cambiaría el comportamiento de
  // todo nodo ya publicado al reparsearse.
  memoria: z
    .object({
      activa: z.boolean().default(true),
      cantidad: z.number().int().min(1).max(30).default(10),
    })
    .optional(),

  // 031 — ficha de conversación. Ausente o false = el nodo no registra ni
  // usa ficha; el prompt queda idéntico al de antes de esta feature.
  ficha: z.object({ activa: z.boolean().default(false) }).optional(),
});
```

---

## Resumen del nodo en el lienzo

`src/workflows/components/editor/resumen-nodo.ts`, caso `ATENCION_IA`. Se
agrega un segmento al final, separado por `·`, solo cuando hay algo que decir:

| Configuración | Texto agregado |
|---|---|
| `memoria` ausente | *(nada — el resumen queda igual que hoy)* |
| `{ activa: true, cantidad: 10 }` | `recuerda 10` |
| `{ activa: false }` | `sin memoria` |
| `ficha.activa === true` | `con ficha` |

Ejemplo completo: `Agente Comercial · hasta 10 mensajes · recuerda 10 · con ficha`

---

## Propagación al motor

```
FormAtencionIA
  → ConfigNodo<"ATENCION_IA">            (definicion/schema.ts)
  → responderIA()                        (workflows/motor/nodos.ts)
  → ParamsRespuestaIA                    (workflows/motor/tipos.ts + ai/respuesta/responder-con-agente.ts)
  → OpcionesContexto                     (ai/contexto/constructor.ts)
  → DecisionContexto                     (ai/contexto/router.ts)
```

Campos nuevos en `ParamsRespuestaIA` — ambos opcionales, ausencia = legacy:

```ts
/** 031 — memoria conversacional del nodo. Ausente: la cantidad de mensajes
 *  la sigue decidiendo el presupuesto de tokens del agente. */
memoria?: { activa: boolean; cantidad: number };

/** 031 — el nodo registra y consume la ficha de la conversación. */
ficha?: boolean;
```

`responderIA` los pasa tal cual desde la configuración del nodo. Ningún otro
llamador de `responderConAgente` los envía, que es cómo se cumple FR-034.
