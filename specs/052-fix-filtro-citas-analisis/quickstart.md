# Quickstart: verificar el nuevo umbral del filtro

**Feature**: `052-fix-filtro-citas-analisis` | **Date**: 2026-11-21

Los tests cubren los motivos y el umbral exacto
([contracts/filtro-privacidad.md](./contracts/filtro-privacidad.md)). Esto cubre lo que solo se ve
contra datos reales.

## Prerequisitos

- Base de datos migrada. **Este hotfix no agrega migración**: si `prisma migrate` propone algo,
  hay un cambio de esquema que no debería estar.
- **El worker corriendo** — el análisis solo corre ahí.
- Una cuenta con el análisis de contactos activado y un proveedor de IA utilizable.

## Comandos

```bash
npm run dev:worker
npm run test:unit -- src/ai/analisis-contactos src/crm/contactos/analisis
npm run build
```

---

## Escenario 1 — La prueba de no-regresión que más importa (FR-003)

**Revalidar los 1284 textos ya aceptados con el umbral nuevo.** Son evaluaciones reales, de
contactos reales, que hoy están guardadas: si alguna dejara de aceptarse, el cambio estaría
rompiendo algo en vez de arreglarlo.

Leer `ContactoEvaluacion.senales/objeciones/motivos` de las evaluaciones de origen IA, recuperar
los mensajes de cada contacto como fuente, y pasar cada texto por el filtro nuevo.

**Esperado**: **1284 de 1284 siguen aceptándose.** Es trivial de predecir —su solape máximo es 24
y el umbral es 40— pero conviene comprobarlo y no deducirlo: es la única verificación que mira
datos reales en volumen.

## Escenario 2 — Los cinco rechazos del diagnóstico pasan a aceptarse (SC-001)

Pasar por el filtro nuevo los cinco textos que se reprodujeron:

| Texto | Solape |
|---|---|
| "Pregunta el precio de las esferas" | 26 |
| "Pidió encargar una esfera lunar" | 26 |
| "Pide ver todos los modelos nuevos" | 29 |
| "Consulta por opciones de personalización" | 28 |
| "Menciona fecha límite para inicios de diciembre" | 26 |

**Esperado**: los cinco se aceptan.

## Escenario 3 — Una cita real se sigue rechazando (FR-005, SC-004)

Tomar un mensaje largo de un cliente y pedir que el texto de salida lo contenga literal (más de
40 caracteres seguidos).

**Esperado**: se rechaza, con motivo de cita.

**Lo que NO debe pasar**: que el control de cita haya quedado inerte. Si cualquier texto pasa, el
umbral quedó por encima del tope de 120 caracteres del campo y el control dejó de existir.

## Escenario 4 — Los controles de forma reconocible no se movieron (FR-004)

Probar un texto con correo, uno con dirección web, uno con un número de 7+ dígitos y uno con una
dirección postal.

**Esperado**: los cuatro se rechazan, cada uno con **su** motivo. Son los controles que este
hotfix **no** toca; si alguno cambió de veredicto, se tocó algo de más.

## Escenario 5 — El motivo queda registrado (US2, FR-006)

Forzar un rechazo de cada tipo y consultar la fila de auditoría del contacto.

**Esperado**: cada rechazo registra su motivo concreto, distinguible de los demás.

**Y lo que NO debe aparecer** (FR-007): ni el texto que generó la IA, ni el tramo que coincidió,
ni fragmento alguno de la conversación. Solo el código.

## Escenario 6 — Recuperar los 7 fallidos (US3, SC-006)

1. Con el arreglo **ya desplegado** —antes no sirve, vuelven a caer en el mismo filtro y
   consumen otras cinco llamadas pagas—, usar el botón de reintentar fallidos de la pantalla de
   Análisis de Contactos.

**Esperado**: los 7 vuelven a la cola y quedan evaluados en la siguiente vuelta del worker. El
contador de fallidos baja a 0.

2. Verificar que **no se construyó nada nuevo** para esto: el botón ya existía (Decisión 5).

---

## Verificaciones que no se ven en pantalla

### La tasa de rechazos (SC-003)

Comparar la proporción de ítems inválidos antes y después. La base histórica es **99 de 1711
(5,8 %)**.

**Esperado**: muy por debajo de eso. Si se mantuviera, hay otra causa que el diagnóstico no
encontró — y ahora el motivo registrado dice cuál, que es justamente el punto de US2.

### El resto del análisis no se movió (FR-008)

- **Reglas y puntaje**: un contacto que se evalúa solo por reglas da el mismo resultado.
- **Cola y reintentos**: un fallo recuperable se sigue reintentando con espera creciente y
  termina en fallido tras cinco intentos, no al primero.
- **Consumo y costo**: cada evaluación sigue registrando sus tokens y su costo.
- **Lo que se escribe en el contacto**: la IA sigue sin escribir hechos ni "No contactar"
  (FR-009); el nivel de interés se aplica por el camino de siempre.

### El lote ininteligible sigue partiéndose

Forzar una respuesta que no se pueda interpretar.

**Esperado**: el lote se parte en mitades hasta llegar a uno, como hoy. 052 no toca ese camino, y
conviene confirmarlo porque comparte archivo con lo que sí se tocó.
