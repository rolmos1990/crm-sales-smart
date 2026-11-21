# Contrato: filtro de privacidad y motivo de rechazo

**Feature**: `052-fix-filtro-citas-analisis` | **Date**: 2026-11-21

Dos funciones y un punto de escritura. Las formas de datos están en
[../data-model.md](../data-model.md).

---

## 1. `contieneDatosPrivados` — `src/ai/analisis-contactos/salida.ts`

```ts
export type MotivoPrivacidad =
  | "EMAIL" | "URL" | "SECUENCIA_NUMERICA" | "DIRECCION" | "CITA";

export function contieneDatosPrivados(
  textoSalida: string,
  fuentesNormalizadas: string[],
): MotivoPrivacidad | null
```

Devuelve el motivo por el que el texto **no** puede guardarse, o `null` si es aceptable.

> **Cambio de tipo de retorno, no de lógica.** El orden de evaluación y las expresiones regulares
> quedan idénticos: ningún texto cambia de veredicto por esta función. Lo único que cambia un
> veredicto es el umbral (ver § 2).

### Orden de evaluación — fijo, y el test lo vigila

| # | Control | Sobre qué | Motivo |
|---|---|---|---|
| 1 | Correo | texto crudo | `EMAIL` |
| 2 | Dirección web | texto crudo | `URL` |
| 3 | 7+ dígitos seguidos | texto crudo | `SECUENCIA_NUMERICA` |
| 4 | Dirección postal | texto normalizado | `DIRECCION` |
| 5 | Copia de la conversación | texto normalizado | `CITA` |

Un texto que dispara dos controles reporta **el primero**. Reordenar no cambia qué se rechaza,
pero sí qué motivo queda registrado — y ese registro es el que evita la próxima investigación a
mano.

### Lo que NO cambia

Los controles 1 a 4 quedan **exactamente** como están: mismas expresiones, mismos umbrales, mismos
casos. La batería de `salida.test.ts:78-100` debe seguir pasando sin tocar una línea (FR-004).

---

## 2. `LARGO_CITA` — el umbral

```ts
const LARGO_CITA = 40;   // antes 25
```

Un texto se considera copia si **algún tramo de `LARGO_CITA` caracteres** del texto normalizado
aparece literal en alguna fuente normalizada.

### El número sale de una medición, y bajarlo exige repetirla

| | Solape máximo |
|---|---|
| 1284 textos **aceptados** (400 evaluaciones de IA en producción) | **24** — p50 9, p90 15, p95 19, p99 22 |
| 5 textos **rechazados** reproducidos contra la API | **26–29** |
| Cita real del test existente (`salida.test.ts:102`) | **48** |

El máximo aceptado (24) es uno menos que el umbral viejo (25) porque **la muestra está censurada
por ese umbral**, no porque 25 fuera holgado. Entre 24 y 26 no hay frontera natural: es una sola
distribución de paráfrasis partida al medio.

**40 deja ~38 % de margen sobre el peor falso positivo y sigue atrapando una oración entera.**

> Esta tabla va en el comentario de la constante, no solo acá. Sin ella, el próximo que vea "40"
> lo baja "por las dudas" y reintroduce el bug.

### Casos borde que el test cubre

- Solape de 29 (el peor falso positivo medido) → **se acepta**.
- Solape de 39 → se acepta; de 40 → se rechaza. Fija el umbral exacto.
- La cita de 48 caracteres de `salida.test.ts:102` → **se sigue rechazando**.
- Texto más corto que el umbral → no puede ser cita, se evalúa solo por los otros cuatro controles.
- Sin fuentes (contacto sin conversación) → el control de cita no aplica.
- Los cinco textos reales del diagnóstico → los cinco se aceptan.

---

## 3. `validarSalidaLote` — propagar el motivo

```ts
export interface ResultadoValidacion {
  validos: Map<string, ResultadoIAContacto>;
  /** contactoId → motivo del rechazo. Antes era `string[]`. */
  invalidos: Map<string, MotivoRechazo>;
  omitidos: string[];
  loteInvalido: boolean;
}

export type MotivoRechazo =
  | "REF_DUPLICADA"
  | "FORMATO_INVALIDO"
  | `PRIVACIDAD_${MotivoPrivacidad}`;
```

### Reglas

| Caso | Motivo |
|---|---|
| La IA evaluó dos veces la misma referencia | `REF_DUPLICADA` |
| La evaluación no pasa el esquema | `FORMATO_INVALIDO` |
| Algún texto libre dispara el filtro | `PRIVACIDAD_<motivo>` |
| La referencia falta en la respuesta | queda en `omitidos`, **no** en `invalidos` |
| La referencia es ajena o inventada | se descarta en silencio, como hoy |
| El JSON entero no se interpreta | `loteInvalido: true`, como hoy — se parte el lote en mitades |

**El primer texto que dispare manda.** Un contacto con dos textos problemáticos reporta el motivo
del primero, en el orden `senales → objeciones → motivos → motivoNoContactar`.

### Lo que NO cambia

- Qué contactos se rechazan: idéntico salvo por el umbral.
- `loteInvalido` y la partición en mitades (`ejecutor.ts:372-394`): intactos.
- `omitidos`: intacto.

---

## 4. La escritura en auditoría — `src/crm/contactos/analisis/motor/ejecutor.ts`

En `itemsSinResultado` (`ejecutor.ts:402-408`), el `errorCodigo` deja de ser la constante
`"RESPUESTA_INVALIDA"` y pasa a ser el motivo del contacto.

```
estado INVALIDO  → errorCodigo = motivo concreto
estado OMITIDO   → errorCodigo = "RESPUESTA_INVALIDA"   (la IA no lo mencionó)
```

### Invariantes

1. **El código registrado pertenece a un conjunto cerrado.** Nunca texto generado por la IA, nunca
   un fragmento de la conversación, nunca el tramo que coincidió (FR-007). Esto último sería lo
   más útil para diagnosticar y es justamente lo prohibido: ese tramo son palabras del cliente.
2. **`EjecucionAnalisisContactos.errorCodigo` no cambia**: sigue `RESPUESTA_INVALIDA`. Una
   ejecución agrupa contactos con motivos distintos; un código único ahí mentiría.
3. **El contacto sigue volviendo a la cola igual.** `devolverConBackoff` recibe los mismos ids, con
   el mismo conteo de intentos. 052 no toca el ciclo de reintentos.

### Casos borde que el test cubre

- Un contacto por cada motivo → cada uno registra el suyo.
- Un contacto omitido → conserva `RESPUESTA_INVALIDA`.
- Un lote con un inválido y un válido → el válido se escribe; el inválido registra su motivo y
  vuelve a la cola (ya cubierto por `salida.test.ts:108`, que debe seguir pasando).
