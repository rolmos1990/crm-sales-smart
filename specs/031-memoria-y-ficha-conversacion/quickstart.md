# Quickstart: validar memoria y ficha de conversación

**Feature**: `031-memoria-y-ficha-conversacion` | **Fecha**: 2026-11-14

Guía de validación. Cada bloque se puede correr solo; el orden sigue las
historias P1 → P2 → P3.

---

## Prerequisitos

```bash
npm install
npm run db:migrate          # aplica la migración de FichaConversacionIA (P2+)
npm run db:seed
```

Además, en la instancia de prueba:

- **Configuración → IA** habilitada, con al menos un proveedor activo.
- Un **agente COMERCIAL** con herramientas habilitadas (al menos
  `buscar_productos` y `consultar_precio_actual`).
- Un **producto activo con precio** — los escenarios de abajo usan
  "Esfera lunar", USD 16.
- Un **Workflow** con un nodo **Atención IA** apuntando a ese agente.

---

## Paso 0 — La red de seguridad, antes de tocar nada

Es lo primero que hay que ver en verde: prueba que la feature no cambió el
comportamiento de lo que ya estaba corriendo (SC-001, FR-030).

```bash
npm run test:unit -- src/ai/prompt/builder.test.ts src/ai/contexto/context-builder.test.ts
```

**Esperado**: el `systemPrompt` de un agente sin ficha es **byte a byte
idéntico** al fixture congelado antes de la feature. Si este test falla, nada
más importa.

```bash
npm run test:unit -- src/workflows/definicion/catalogo-nodos.test.ts
```

**Esperado**: `configInicial()` de `ATENCION_IA` sigue sin las claves `memoria`
ni `ficha`. Un nodo nuevo nace en estado "ausente" (contracts D4).

---

## Paso 1 — Memoria conversacional (P1)

### 1a. Unitario

```bash
npm run test:unit -- src/ai/contexto/constructor.test.ts src/ai/contexto/router.test.ts
```

**Esperado**:

| Caso | Resultado |
|---|---|
| `memoria` ausente | Misma cantidad que antes de la feature (13 con `limiteTokensCtx = 4000`) |
| `{ activa: true, cantidad: 5 }` sobre 20 mensajes | Exactamente 5, los más recientes, en orden cronológico |
| `{ activa: true, cantidad: 5 }` sobre 2 mensajes | 2, sin error |
| `{ activa: true, cantidad: 1 }` | 1 — **sin** el piso de 3 actual |
| `{ activa: false }` | 1 solo mensaje, y su remitente es `CONTACTO` |
| 8 mensajes de los cuales 3 no tienen texto, pidiendo 5 | 5 mensajes **con texto** |
| `maxMensajes: 15` junto a `memoria.cantidad: 30` | 15 — el tope duro gana |

### 1b. En el editor

```bash
npm run dev
```

1. Abrir el Workflow → nodo **Atención IA**.
2. Confirmar que aparecen **"Leer mensajes anteriores"** y, al encenderlo,
   **"Cuántos recordar"** con 10.
3. Poner 3. La tarjeta del nodo en el lienzo debe mostrar `· recuerda 3`.
4. Poner 40 → la publicación del Workflow debe quedar bloqueada con el error de
   rango (FR-008).
5. Volver a 3, publicar.

### 1c. End-to-end

```bash
npm run dev:full                        # app + worker
npm run script:simular-wa               # o script:simular-ig
```

Mandar 6 mensajes con un dato memorable en el primero (p. ej. "soy de Lima").
En el turno 6, preguntarle al agente algo que dependa de ese dato.

**Esperado con "recordar 3"**: el agente **no** lo sabe — quedó fuera de la
ventana. Subir a 10, repetir: ahora sí lo sabe. Eso prueba que la perilla es
real y no decorativa.

---

## Paso 2 — Ficha: hechos registrados (P2)

### 2a. Unitario

```bash
npm run test:unit -- src/ai/ficha-conversacion/ src/ai/contexto/capas/estado-conversacion.test.ts
```

**Esperado** (reglas de research D6/D7/D8/D14):

| Caso | Resultado |
|---|---|
| `consultar_precio_actual` devolvió 16 y el mensaje dice "USD 16" | Se registra el precio |
| El mensaje dice "16,00" / "16.00" | Se registra igual — el comparador tolera formato |
| `buscar_productos` devolvió 5 precios y el mensaje menciona uno | Se registra **solo** ese |
| El mensaje dice "alrededor de 15" | **No** se registra — falso negativo preferido a falso positivo |
| El mensaje termina en "¿Desea ver el catálogo?" | Queda como última pregunta, con `turnosDesde: 0` |
| Turno sin señal de producto | Se conserva el producto anterior |
| `ficha.actualizadoEn < conversacion.atencionDesde` | La capa 6 devuelve `null` |

### 2b. La ficha nunca rompe un envío (FR-014, SC-007)

```bash
npm run test:unit -- src/ai/respuesta/responder-con-agente.test.ts
```

**Esperado**: con la escritura de la ficha fallando, `accion` sigue siendo
`ENVIADO` y `mensajeId` viene definido. Y con `accion !== "ENVIADO"` (pendiente
de revisión / no generado / omitido) **no se escribe ninguna fila**.

### 2c. End-to-end — el escenario que motivó la feature

Con **"Recordar en qué va la conversación"** encendido y publicado:

| Turno | Escribir | Esperado |
|---|---|---|
| 1 | `¿cuánto cuesta la esfera lunar?` | El agente informa un precio, p. ej. USD 16 |
| — | — | En BD: `FichaConversacionIA` de esa conversación tiene `hechos.ultimoPrecioInformado.monto = 16` y `productoEnFoco` apuntando a la esfera |
| 2 | `y tienen envío a Lima?` | Responde sobre envío **sin** cambiar el precio |
| 3 | `me recordás el precio?` | **SC-004**: el mismo monto, o anuncio explícito de que cambió |

Y para **SC-005**:

| Turno | Escribir | Esperado |
|---|---|---|
| 1 | `hola` | El agente pregunta algo, p. ej. "¿desea ver el catálogo?" |
| 2 | `qué horarios tienen?` | Contesta el horario **y retoma** la pregunta del catálogo, en vez de abrir un tema nuevo |

```bash
npm run db:studio      # inspeccionar FichaConversacionIA entre turnos
```

---

## Paso 3 — Lectura interpretada (P3)

### 3a. Unitario

```bash
npm run test:unit -- src/ai/ficha-conversacion/extraccion.test.ts
```

**Esperado**:

| Caso | Resultado |
|---|---|
| El proveedor devuelve JSON válido | `LecturaConversacion` poblada |
| El proveedor falla / vence el timeout de 10 s | `null`, y el llamador **conserva** la lectura anterior (FR-023) |
| Devuelve texto que no parsea | Igual: `null`, lectura anterior intacta |
| `intencion` trae un valor fuera de `IntencionComercial` | Se descarta a `null`, no se propaga |

### 3b. Latencia (FR-022, SC-003)

Medir el tiempo entre el mensaje del cliente y el mensaje enviado, con la ficha
apagada y encendida, en el mismo escenario.

**Esperado**: sin diferencia apreciable. La derivación corre después del envío;
si aparece delay, está corriendo en el lugar equivocado (research D10).

### 3c. Simulador (FR-032)

**Configuración → IA → Simulador**: correr un escenario y confirmar que el
contexto incluye las capas 6 y 7 armadas desde la ficha **simulada**, sin
ninguna escritura en la tabla real.

---

## Cierre

```bash
npm run test:unit
npm run build
```

Ambos tienen que pasar — la constitución (principio V) no considera completo un
cambio que no compila o cuyos tests no pasan.

### Checklist de criterios de éxito

| | Criterio | Dónde se verifica |
|---|---|---|
| SC-001 | Prompt byte-idéntico sin configurar nada | Paso 0 |
| SC-002 | Exactamente N mensajes, N ∈ 1..30 | Paso 1a |
| SC-003 | Sin latencia agregada | Paso 3b |
| SC-004 | No contradice un precio informado | Paso 2c |
| SC-005 | Retoma la pregunta abierta | Paso 2c |
| SC-006 | No vuelve a pedir datos ya dados | Paso 1c + 10 conversaciones piloto |
| SC-007 | Un fallo de ficha nunca pierde un mensaje | Paso 2b |
| SC-008 | Se configura en menos de 1 minuto sin ayuda | Paso 1b |
| SC-009 | Sin ficha, el costo de IA no sube | Paso 0 + contar llamadas en `UsoIA` |
