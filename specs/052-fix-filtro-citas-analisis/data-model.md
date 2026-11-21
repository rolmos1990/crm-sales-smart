# Data Model: El filtro anti-citas deja de rechazar frases comerciales corrientes

**Feature**: `052-fix-filtro-citas-analisis` | **Date**: 2026-11-21

## Cambios de esquema

**Ninguno.** Sin migración, sin columnas, sin enums nuevos, sin backfill.

---

## Lo que se lee

### Los textos libres de la evaluación de la IA

Los únicos que pasan por el filtro: `senales`, `objeciones`, `motivos` y `motivoNoContactar`.
Topados en 5 elementos de 120 caracteres cada uno (`MAX_ITEMS`, `MAX_LARGO` en `salida.ts:19-20`).

Los campos de opción cerrada —intención, urgencia, recuperación, acción sugerida, ajuste de
puntaje— **no pasan por el filtro** y no se tocan: no pueden contener texto del cliente.

### Las fuentes de la conversación

Los mensajes que la IA vio, normalizados (`textosFuente` + `normalizar`). Son el texto contra el
que se busca una coincidencia literal.

> **Cuanto más larga la conversación, más superficie para una coincidencia casual.** Es la razón
> estructural por la que un umbral bajo produce falsos positivos: no depende de que la IA cite,
> sino de cuántos mensajes hay para chocar. Un contacto con 60 mensajes tiene muchas más chances
> que uno con 3, a igualdad de calidad del resumen.

---

## Lo que se escribe

### `EjecucionAnalisisContactosItem.errorCodigo`

`String?` **sin enum** (`prisma/schema.prisma:1053`), y el tipo del dominio ya es `string | null`
(`motor/auditoria.ts:174`). Hoy recibe siempre `"RESPUESTA_INVALIDA"`; pasa a recibir el motivo
concreto.

| Valor | Cuándo |
|---|---|
| `REF_DUPLICADA` | La IA evaluó dos veces al mismo contacto |
| `FORMATO_INVALIDO` | La evaluación no respeta el formato esperado |
| `PRIVACIDAD_EMAIL` | El texto contiene un correo |
| `PRIVACIDAD_URL` | El texto contiene una dirección web |
| `PRIVACIDAD_SECUENCIA_NUMERICA` | El texto contiene 7 o más dígitos seguidos |
| `PRIVACIDAD_DIRECCION` | El texto contiene una dirección postal |
| `PRIVACIDAD_CITA` | El texto copia un tramo largo de la conversación |
| `RESPUESTA_INVALIDA` | Se conserva para el contacto **omitido**: la IA no lo mencionó |

**Nada de esto contiene texto generado ni fragmentos de la conversación** (FR-007). Es un conjunto
cerrado de códigos: el motivo se nombra, no se transcribe.

> `PRIVACIDAD_CITA` es el valor que justifica el cambio entero. Separado de los otros cuatro, la
> próxima vez que suba la tasa de rechazos se sabe en una consulta si es calibración o si de
> verdad está entrando información personal.

### Lo que NO cambia

- `EjecucionAnalisisContactos.errorCodigo` sigue siendo `RESPUESTA_INVALIDA` (Decisión 4).
- `ContactoEvaluacion`: ni un campo. Lo que se guarda de una evaluación aceptada es idéntico.
- `ContactoAnalisisCola`: los estados, los intentos y el backoff quedan igual.
- `ResumenDiarioAnalisisContactos`: sigue contando atenciones y fallos como hoy.

---

## Transición de estado de los contactos fallidos

```
FALLIDO ──(botón "reintentar fallidos" de la pantalla)──>  PENDIENTE
                                                            intentos = 0
                                                            elegibleDesde = ahora
```

Ya existe (`cola.ts:245`) y está acotado por `instanciaId`. **No se agrega nada** (Decisión 5).

Ejecutarlo **antes** de desplegar el arreglo no sirve: los contactos vuelven a caer en el mismo
filtro y consumen otras cinco llamadas pagas.

---

## Invariantes que este hotfix asume

**El orden de evaluación del filtro no cambia.** Primero correo, URL y secuencia numérica sobre el
texto crudo; después dirección sobre el normalizado; por último la cita. Si se reordenara, un
texto con correo **y** cita cambiaría de motivo registrado sin cambiar de veredicto — confuso al
diagnosticar, inofensivo para el dato.

**Los 1284 textos ya aceptados siguen aceptándose.** Trivial de verificar: su solape máximo es 24
y el umbral nuevo es 40. El quickstart lo revalida de todos modos contra producción, porque es la
prueba central de no-regresión (FR-003).

**Un texto nunca se enmascara, se rechaza entero.** Igual que hoy: el contacto queda inválido y
vuelve a la cola. 052 no introduce enmascarado ni recorte parcial.
