# Feature Specification: El nombre del archivo deja de impedir la transcripción

**Feature Branch**: `fix/051-nombre-archivo-voz`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "habia subido un audio de Ramon que nunca se hizo la transcripcion entiendo que ahora correria con Groq (el proveedor) podemos verificar que ocurrio por que no transcribio?"

## Diagnóstico previo (investigación de código + reproducción contra la API real)

### Qué se investigó y dónde

- Base de datos de producción: `MediaArchivo` por `transcripcionEstado`, `UsoVoz` completo,
  `ProveedorVoz` configurados y `ConfiguracionEmpresa.transcripcionVozHabilitada`.
- `src/voz/transcribir.ts:123` — qué se le pasa al proveedor como `nombreArchivo`.
- `src/voz/proveedores/openai-compatible.ts:62-70` — cómo se arma el multipart.
- `src/voz/proveedores/groq.ts:70-85` — cómo se traduce un 400 de Groq.
- `src/app/api/webhooks/instagram/route.ts:183-191` — de dónde sale `nombreOriginal`.
- `src/lib/media/services/media-raw.service.ts:52-81,133` — `extDesde(mime)`, que ya existe y
  se usa para nombrar la clave de storage.
- **Reproducción contra la API real de Groq** con los bytes exactos del audio que falló.

### Qué se confirmó que SÍ funciona (y no se toca)

- **El audio está íntegro.** 42.936 bytes, cabecera `ftypisom`: un MP4 válido de 5,2 s.
- **ElevenLabs transcribe estos mismos audios sin problema.** Los 8 `MediaArchivo` en estado
  `LISTO` son todos `scribe_v3`, todos `video/mp4` de Instagram, todos con nombre sin extensión.
  ElevenLabs identifica el formato por el contenido y no mira el nombre.
- **La cola, el storage y el interruptor funcionan.** El archivo se leyó (`keyOriginal` resuelto),
  se llamó al proveedor, y el fallo se registró en `UsoVoz` como corresponde.
- **El registro de uso es correcto.** La fila existe, con el código funcional y sin filtrar
  credenciales.

### La causa raíz exacta

**Groq valida el archivo por la extensión del nombre que viaja en el formulario, no por el
tipo declarado ni por el contenido.** Instagram entrega las notas de voz sin nombre de archivo,
así que Karia las guarda como `audio-<timestamp>` —sin extensión— y se lo manda tal cual.

Evidencia, con los bytes exactos del audio que falló:

| Qué se mandó | Respuesta de Groq |
|---|---|
| Nombre `audio-1795275488865` (lo que Karia manda hoy) | `400 unsupported_audio_format` — *"file must be one of the following types: [flac mp3 mp4 mpeg mpga m4a ogg opus wav webm]"* |
| **Los mismos bytes**, el mismo tipo declarado, nombre `audio-1795275488865.mp4` | `200` — *"Hola mire, ustedes saben si tienen el Lunada disponible, pero dije que quiero comprar el Saturno, pero no sé si es disponible por ahí."* |

Lo único que cambia entre las dos filas es la extensión del nombre.

**Agravante**: ese 400 se traduce a un código de fallo **permanente**, lo cual es correcto para un
formato genuinamente no admitido pero acá es falso —el formato sí está admitido—. El resultado es
que el audio se marca con error definitivo al primer intento y no se vuelve a intentar nunca.

**El alcance es más amplio que Groq**: el mismo transporte lo usa el proveedor OpenAI, que valida
igual. Cualquier cuenta que elija uno de esos dos como proveedor de voz tiene el mismo problema.

### Por qué el síntoma se explica por esta causa y no por otra

- El fallo tardó **97 ms**: Groq rechazó antes de leer el audio. Un problema real de códec habría
  tardado lo que tarda decodificar.
- El mensaje de error nombra `mp4` entre los tipos admitidos, y el archivo **es** un mp4.
- Los mismos bytes transcriben bien en Groq en cuanto se agrega la extensión, y transcriben bien
  en ElevenLabs sin agregar nada.
- No es la credencial (sería 401), ni el tamaño (42 KB contra un tope de 25 MB), ni cuota (sería
  429), ni el modelo (el mensaje habría nombrado `model`).

### Lo que esta investigación encontró y queda FUERA de alcance

Hay otros dos `MediaArchivo` en error, de antes de que existiera Groq, que fallaron contra
ElevenLabs con un código distinto. Uno agotó sus cinco reintentos pero solo dejó **una** fila de
uso, lo que sugiere que cuatro de esos intentos fallaron antes de llegar al proveedor y no
quedaron registrados. **Es otra causa y merece su propia investigación**; este hotfix no la toca
ni la recupera.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La nota de voz se transcribe aunque llegue sin nombre de archivo (Priority: P1)

Un cliente manda una nota de voz por Instagram. El comercio tiene Groq (u OpenAI) como proveedor
de transcripción. Hoy ese audio muere con error definitivo y el agente tiene que reproducirlo a
mano; la IA y los Workflows no ven nada.

Con el arreglo, el audio se transcribe igual que si el proveedor fuera ElevenLabs. El comercio no
hace nada distinto ni nota que hubo un problema: simplemente funciona.

**Why this priority**: es el fallo reportado. Sin esto, elegir Groq u OpenAI rompe la
transcripción de Instagram por completo, que es el canal donde más notas de voz llegan.

**Independent Test**: con Groq como único proveedor activo, mandar una nota de voz por Instagram
y verificar que aparece transcrita, sin ningún error registrado.

**Acceptance Scenarios**:

1. **Given** una cuenta con Groq activo y una nota de voz de Instagram cuyo nombre de archivo no
   tiene extensión, **When** el sistema la transcribe, **Then** el texto queda disponible y no se
   registra ningún fallo.
2. **Given** la misma cuenta con OpenAI en vez de Groq, **When** llega la misma nota de voz,
   **Then** ocurre lo mismo: se transcribe sin fallo.
3. **Given** una cuenta con ElevenLabs, **When** llega la misma nota de voz, **Then** se
   transcribe exactamente como hoy — el arreglo no cambia nada de lo que ya funcionaba.
4. **Given** una nota de voz de un canal que sí trae nombre con extensión, **When** se transcribe,
   **Then** el nombre no se altera ni se le agrega una segunda extensión.
5. **Given** un audio en un formato que el proveedor genuinamente no admite, **When** se intenta
   transcribir, **Then** sigue fallando con error definitivo y no se reintenta — ese
   comportamiento no se relaja.

---

### User Story 2 - Recuperar las notas de voz que murieron por esta causa (Priority: P2)

Las notas de voz que ya fallaron por este motivo quedaron con error definitivo. El audio está
intacto y se transcribe bien; lo único que faltaba era el arreglo. Sin una recuperación explícita,
quedan muertas para siempre aunque el problema esté resuelto.

El responsable técnico puede devolverlas a la cola, viendo primero cuáles se verían afectadas y
confirmando después.

**Why this priority**: entrega valor real —el audio de Ramón vuelve a estar disponible— pero no
bloquea el arreglo. Desplegar solo la US1 ya evita que el problema se repita.

**Independent Test**: con el arreglo desplegado, ejecutar la recuperación en modo simulación,
verificar que lista exactamente las notas de voz que fallaron por esta causa, aplicarla, y
confirmar que terminan transcritas.

**Acceptance Scenarios**:

1. **Given** notas de voz con error definitivo causado por este problema, **When** se ejecuta la
   recuperación sin confirmar, **Then** informa cuáles se verían afectadas y **no modifica nada**.
2. **Given** lo mismo, **When** se ejecuta confirmando, **Then** esas notas vuelven a la cola y
   terminan transcritas.
3. **Given** notas de voz que fallaron por OTRA causa, **When** se ejecuta la recuperación,
   **Then** **no** se tocan: la recuperación distingue la causa, no barre todos los errores.
4. **Given** una cuenta sin ninguna nota de voz afectada, **When** se ejecuta, **Then** informa
   que no hay nada que recuperar y termina sin error.
5. **Given** notas ya transcritas correctamente, **When** se ejecuta, **Then** no se vuelven a
   transcribir — nadie paga dos veces por el mismo audio.

---

### Edge Cases

- **Nombre sin extensión** (Instagram): el caso que motiva el hotfix.
- **Nombre con extensión** (canales que la traen): no se duplica ni se reemplaza.
- **Tipo declarado con parámetros** (por ejemplo, un formato con el códec anotado al lado): el
  sistema debe quedarse con el tipo base y no confundirse con el resto.
- **Tipo declarado que el sistema no sabe traducir a extensión**: no se inventa una. Se recurre al
  nombre con que el archivo quedó guardado, que sí lleva extensión.
- **Formato genuinamente no admitido**: sigue fallando con error definitivo (US1, escenario 5).
- **Audio sin habla**: sigue quedando marcado como inaudible y no se reintenta. Sin cambios.
- **Recuperación ejecutada dos veces**: la segunda no encuentra nada que hacer.
- **Recuperación mientras el sistema está transcribiendo**: no puede arrebatarle un audio a un
  proceso en curso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST enviar a los proveedores de transcripción un nombre de archivo que
  lleve siempre una extensión coherente con el tipo real del audio.
- **FR-002**: La extensión MUST derivarse del tipo declarado del archivo. Si no se puede traducir,
  MUST recurrirse al nombre con que el archivo quedó guardado, que ya lleva una. **Nunca se
  inventa una extensión**: adivinar mal convierte un fallo entendible en uno confuso.
- **FR-003**: Un nombre que ya trae extensión MUST enviarse sin alterar.
- **FR-004**: El arreglo MUST aplicar a **todos** los proveedores que validan por nombre, no solo
  al que reportó el fallo.
- **FR-005**: El comportamiento de los proveedores que identifican el formato por contenido MUST
  quedar **idéntico**: mismo nombre enviado o no, el resultado no cambia.
- **FR-006**: Un formato genuinamente no admitido MUST seguir fallando de forma definitiva, sin
  reintentos. La clasificación de ese fallo no se relaja.
- **FR-007**: El resto del flujo de transcripción —la cola, los reintentos, el tope diario de
  minutos, el registro de uso y costo, la decisión de inaudible— MUST quedar sin cambios.
- **FR-008**: MUST existir una forma de devolver a la cola las notas de voz que fallaron por esta
  causa.
- **FR-009**: La recuperación MUST simular por defecto e **exigir confirmación explícita** para
  modificar algo.
- **FR-010**: La recuperación MUST afectar **solo** a las notas que fallaron por esta causa, y
  dejar intactas las que fallaron por otra.
- **FR-011**: La recuperación MUST NOT volver a transcribir audios ya transcritos ni arrebatar uno
  que el sistema esté procesando en ese momento.
- **FR-012**: Una nota de voz recuperada MUST registrar su uso y costo como cualquier otra.

### Key Entities

- **Archivo de media**: el audio guardado, con su nombre de origen, su tipo declarado, el nombre
  con que quedó en el almacenamiento y el estado de su transcripción. El nombre de origen es lo
  que hoy se le manda al proveedor, y lo que esta corrección deja de mandar tal cual.
- **Registro de uso de voz**: una fila por intento, con el código funcional del fallo. Es lo que
  permite distinguir qué notas fallaron por **esta** causa y cuáles por otra (FR-010).
- **Proveedor de transcripción**: los hay de dos clases —los que identifican el formato por el
  nombre y los que lo identifican por el contenido—. Esa diferencia, invisible hasta ahora, es la
  que este hotfix vuelve irrelevante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con Groq u OpenAI como proveedor, el 100 % de las notas de voz de Instagram que hoy
  fallan por esta causa se transcriben correctamente.
- **SC-002**: Elegir un proveedor de voz u otro deja de cambiar si una nota de voz se transcribe:
  los tres proveedores dan el mismo resultado sobre el mismo audio.
- **SC-003**: Las notas de voz que ya murieron por esta causa quedan recuperadas y transcritas,
  sin tocar las que fallaron por otra.
- **SC-004**: No aparece ningún fallo nuevo en las notas de voz que ya se transcribían bien.
- **SC-005**: El costo de la recuperación es el de transcribir cada audio afectado **una sola vez**.

## Assumptions

- **El arreglo va en el borde con el proveedor, no en la entrada del archivo.** Cambiar cómo
  Instagram nombra lo que guarda no serviría: no arregla los archivos ya guardados —que son los
  que hay que recuperar— y dejaría el mismo agujero abierto para cualquier canal futuro que
  tampoco traiga nombre. Corregirlo donde se arma la petición cubre todos los canales y todos los
  archivos, nuevos y viejos, de una sola vez.
- **No se agrega ni se cambia nada en el modelo de datos.** La información necesaria —el tipo
  declarado y el nombre guardado— ya está en el archivo.
- **La traducción de tipo a extensión ya existe en el proyecto** y se usa para nombrar lo que se
  guarda. El plan decidirá si se reutiliza o se define una propia en el módulo de voz; lo que el
  spec exige es que no haya dos listas que se arreglen por separado.
- **La recuperación es puntual, no un proceso permanente.** Se ejecuta una vez con el arreglo ya
  desplegado; no se agrega un barrido automático que resucite errores, porque los demás errores
  definitivos lo son por buenas razones.
- **Los dos fallos contra ElevenLabs quedan fuera**, incluida la sospecha de que hubo cuatro
  intentos sin registro de uso. Es otra causa y merece su propia investigación.
- **No se cambia la clasificación del fallo de formato.** Sigue siendo definitivo. Lo que cambia
  es que deje de dispararse cuando el formato sí era válido.
