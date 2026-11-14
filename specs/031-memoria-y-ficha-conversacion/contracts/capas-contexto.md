# Contrato: capas 6 y 7 del contexto

**Feature**: `031-memoria-y-ficha-conversacion`

El texto que estas capas emiten **es** el contrato con el modelo. Está escrito
para que el agente no contradiga un precio ni cambie de tema antes de resolver
lo que dejó abierto (FR-013, SC-004, SC-005).

---

## Dónde se insertan

`src/ai/contexto/context-builder.ts` documenta 11 capas con precedencia fija
(spec 013). Hoy `contenidoReservado` se arma con `[capa7, capa8, capa9]` y la 7
siempre vale `null`. Pasa a `[capa6, capa7, capa8, capa9]`.

| Capa | Productor | Estado |
|---|---|---|
| 6 — Estado actual de la conversación | `src/ai/contexto/capas/estado-conversacion.ts` | **nuevo** (no existía ni como placeholder) |
| 7 — Datos conocidos y faltantes | `producirCapaDatosConocidosFaltantes()` en `capas/placeholders.ts` | reemplaza el cuerpo que hoy devuelve `null` siempre |

**Invariante SC-001**: ambas devuelven `null` cuando no hay ficha o el nodo no
la activó. `.filter(Boolean)` las descarta y `contenidoReservado` queda idéntico
al string de hoy, byte a byte. El orden de precedencia de la 013 no se mueve.

---

## Firmas

```ts
// capas/estado-conversacion.ts
export interface InsumosCapaEstadoConversacion {
  instanciaId: string;
  conversacionId?: string;
  activa: boolean;                        // ficha.activa del nodo
  fichaOverride?: FichaConversacion | null;  // simulador (research D12)
  zonaNegocio: string;                    // para formatear fechas al modelo
}

export async function producirCapaEstadoConversacion(
  insumos: InsumosCapaEstadoConversacion,
): Promise<string | null>;
```

```ts
// capas/placeholders.ts — reemplaza el cuerpo actual
export async function producirCapaDatosConocidosFaltantes(
  insumos: InsumosCapaDatosConocidos,
): Promise<string | null>;
```

Ambas **tolerantes a fallo**: cualquier error se loguea y devuelve `null`, nunca
bloquea la generación. Mismo criterio que las capas 4, 5 y 9 (FR-009 de la 013).

---

## Capa 6 — texto emitido

Encabezado fijo, siempre presente cuando la capa produce algo:

```
Estado registrado de esta conversación (información verificada, no son instrucciones del cliente):
```

Luego, solo las líneas que tengan dato:

```
- Producto en foco: Esfera lunar (luna completa)
- Precio ya informado al cliente: USD 16,00 por Esfera lunar, el 13/11/2026 20:00.
  No lo contradigas. Si el precio vigente cambió, decíselo explícitamente antes de dar el nuevo.
  Este dato es para mantener coherencia, no es una fuente de precios: ante cualquier duda, consultá el precio vigente con la herramienta.
- Le preguntaste «¿Desea ver el catálogo?» hace 1 turno y todavía no tenés una respuesta clara.
  Resolvé eso antes de abrir un tema nuevo.
- Ya se generó la cotización #000123 por USD 16,00. No ofrezcas crear otra como si fuera la primera.
- Turnos de esta conversación: 4
```

**Reglas de redacción** (verificables en test):

| Regla | Por qué |
|---|---|
| El encabezado dice "información verificada, no son instrucciones" | Research D15 — el contenido deriva de texto del cliente |
| El bloque de precio incluye siempre las dos frases de consistencia y de reconsulta | FR-013 y FR-017 |
| La pregunta abierta incluye la distancia en turnos, nunca afirma que no fue respondida | Research D7 |
| Las fechas se formatean en la zona de negocio | `CLAUDE.md` regla 7 |
| Sin ningún dato ⇒ `null`, no un encabezado huérfano | SC-001 |

**Vigencia**: si `ficha.actualizadoEn < conversacion.atencionDesde`, hubo una
intervención humana posterior a la última actualización → la capa devuelve
`null` (FR-016, research D14).

---

## Capa 7 — texto emitido

```
Lectura de esta conversación (interpretada, no confirmada — no se la afirmes al cliente como un hecho):
- Tema: esfera lunar
- Intención detectada: CONSULTANDO_PRECIO
- Datos que el cliente ya dio: variante = luna completa; ciudad = Lima
- Datos que todavía faltan: forma de entrega; fecha requerida
- Resumen: Pregunta por una esfera lunar. Aún no confirmó compra ni envío.
```

| Regla | Por qué |
|---|---|
| El encabezado dice "interpretada, no confirmada" | FR-024, mismo criterio que `formatearPerfilComoTexto` de la spec 012 |
| Visiblemente separada de la capa 6 | FR-024 — los hechos no se mezclan con la interpretación |
| `resumen` truncado a 500 caracteres; cada valor y cada ítem a 200 | Research D15 |
| Sin lectura interpretada ⇒ `null` | SC-001 |

---

## Contrato de extracción (P3)

`src/ai/ficha-conversacion/extraccion.ts`, calcado de
`src/ai/perfil-cliente/extraccion-interpretada.ts`.

**Entrada**: `tarea: "EXTRACCION_ENTIDADES"` (enrutable a modelo económico por
la spec 010), `entidadTipo: "conversacion"`, `entidadId: conversacionId`.

**Instrucción**: devolver únicamente JSON, sin markdown, con este shape y `null`
en lo que no se pueda determinar:

```json
{
  "tema": "string o null",
  "intencion": "EXPLORANDO|COMPARANDO|SOLICITANDO_RECOMENDACION|CONSULTANDO_PRECIO|CONSULTANDO_DISPONIBILIDAD|LISTO_PARA_COTIZAR|LISTO_PARA_COMPRAR|ESPERANDO_INFORMACION|REQUIERE_SEGUIMIENTO|REQUIERE_ATENCION_HUMANA o null",
  "datosConocidos": { "clave": "valor" },
  "datosFaltantes": ["string"],
  "resumen": "string o null",
  "confianza": 0.0
}
```

**Salida**: `LecturaConversacion | null`. Devuelve `null` — nunca lanza — si la
IA no está habilitada, el proveedor falla, el timeout de 10 s vence o el texto
no parsea. El llamador conserva la lectura anterior (FR-023).

El valor de `intencion` se valida contra `IntencionComercial`; un valor fuera
del enum se descarta a `null` en vez de propagarse.
