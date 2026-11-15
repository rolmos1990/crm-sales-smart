# Feature Specification: Documentación del comercio consultable bajo demanda

**Feature Branch**: `033-documentacion-vector-store-openai`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Los archivos que el negocio sube como FAQ y Documentos en la configuración del Agente IA dejan de ser analizados y resumidos por la IA, y pasan a indexarse para consultarse bajo demanda mediante búsqueda documental. El agente decide cuándo consultarlos. Cada búsqueda debe registrar su consumo de tokens. De cada archivo solo se ve el nombre. Al eliminar un documento debe borrarse de verdad del servicio de indexación. El aislamiento entre cuentas debe garantizarse siempre."

> **Nota de numeración**: se usa `033` y no `032` porque los comentarios `// 032 —` ya presentes en el código
> (`src/configuracion/ia/conocimiento/`) refieren a la base de conocimiento FAQ que esta feature reemplaza.
> Reusar ese número dejaría ambiguos los comentarios existentes.

> **Por qué es Feature y no Hotfix**: Karia nunca tuvo búsqueda documental bajo demanda. Lo que existe hoy
> —resumir un documento y pegarlo en el contexto— sí funciona y hace exactamente lo que promete; se lo
> reemplaza por una capacidad nueva, no se lo corrige. Ver el árbol de decisión en `docs/SPEC-KIT-WORKFLOWS.md`.

---

## Contexto del cambio

Hoy, cuando el negocio sube un documento en **Agente IA → Conocimiento → FAQ y documentos**, el sistema lo
resume automáticamente hasta un texto corto y lo inserta completo en el contexto del agente en **cada
respuesta**. Eso impone tres límites que el negocio sufre a diario:

1. **Lo que no sobrevive al resumen se pierde para siempre.** Un manual de 40 páginas queda reducido a un
   párrafo; todo lo demás el agente no lo sabe y no puede recuperarlo.
2. **Se paga en cada mensaje**, aunque la consulta del cliente no tenga nada que ver con el documento.
3. **Solo se aceptan dos formatos** y como máximo tres archivos.

Esta feature reemplaza ese mecanismo: los documentos se **indexan íntegros** y el agente los **consulta solo
cuando le hace falta**, decidiendo él mismo cuándo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar y eliminar documentación del comercio (Priority: P1)

El responsable del negocio entra al editor del agente, abre la sección de documentación y sube los archivos
que describen cómo trabaja su comercio: la política de envíos en PDF, el manual de cuidado de materiales en
Word, las preguntas frecuentes en un TXT. Ve una lista simple donde cada archivo aparece **por su nombre y
nada más**: sin texto editable, sin botón de entrenar, sin contador de caracteres. Cuando un archivo deja de
estar vigente lo elimina, y queda borrado de verdad en todos lados.

**Why this priority**: Es el cimiento y entrega valor por sí solo. Sin documentos cargados no hay nada que
consultar; con ellos cargados el negocio ya tiene su documentación centralizada, identificada y aislada,
aunque el agente todavía no la use. Además es donde vive el requisito de seguridad más fuerte de la feature.

**Independent Test**: Se prueba entero subiendo tres archivos de formatos distintos, verificando que la lista
muestre solo nombres y estados, eliminando uno y confirmando que desapareció del servicio de indexación, del
almacenamiento y de la lista. No requiere que el agente responda nada.

**Acceptance Scenarios**:

1. **Given** un agente sin documentación, **When** el responsable sube un PDF de políticas de envío,
   **Then** el archivo aparece en la lista mostrando **únicamente su nombre**, su estado y la opción de
   eliminarlo, y queda disponible para consulta.
2. **Given** un archivo en proceso de indexación, **When** el responsable mira la lista, **Then** ve un
   estado "Indexando" que cambia a "Listo" al terminar, sin tener que ejecutar ninguna acción adicional.
3. **Given** un documento cargado y listo, **When** el responsable lo elimina, **Then** el documento
   desaparece de la lista, deja de ser consultable, y su archivo se borra del servicio de indexación — no
   queda solo desindexado.
4. **Given** el responsable intenta subir una imagen (PNG, SVG o JPG), **When** la selecciona, **Then** el
   sistema la rechaza con un mensaje que explica que las imágenes no se pueden indexar como documentación y
   qué formato usar en su lugar.
5. **Given** dos comercios distintos con documentación cargada, **When** cualquiera de los dos consulta su
   documentación, **Then** nunca recibe contenido del otro, bajo ninguna circunstancia.
6. **Given** un documento cargado, **When** se inspecciona cualquier dato que el sistema envía al navegador,
   **Then** no aparece ningún identificador interno del servicio de indexación.

---

### User Story 2 - El agente consulta la documentación cuando hace falta (Priority: P2)

Un cliente le escribe al agente por WhatsApp: *"¿hacen envíos a todo el país?"*. El agente reconoce que es
información estable del comercio que probablemente esté en la documentación, la consulta, y responde con lo
que dice la política de envíos. Si en cambio el cliente pregunta el precio de un producto, el agente **no**
toca la documentación: usa los datos vigentes de Karia. Si saluda, el agente simplemente saluda. Y si busca y
no encuentra nada claro, lo dice en vez de inventarlo.

Al mismo tiempo, el responsable del negocio ve cada una de esas búsquedas reflejada en el registro de consumo
de IA, con sus tokens y su costo, igual que cualquier otra llamada a la IA.

**Why this priority**: Es el valor central de la feature para el cliente final, pero depende de que P1 exista.
La contabilización viaja con esta historia y no después: una búsqueda que no se registra es consumo invisible.

**Independent Test**: Con documentación ya cargada (P1), se prueba en el simulador de agente recorriendo los
cinco casos de la política (saludo, info estable, precio, pregunta sin respuesta en los documentos, pregunta
ya contestada en la conversación) y verificando en el registro de consumo que aparece una entrada por cada
búsqueda realizada — y solo por esas.

**Acceptance Scenarios**:

1. **Given** un agente con la política de envíos cargada, **When** el cliente pregunta *"¿hacen envíos a todo
   el país?"*, **Then** el agente consulta la documentación y responde con lo que dice el documento.
2. **Given** el mismo agente, **When** el cliente pregunta el precio de un producto, **Then** el agente
   responde con el precio vigente de Karia y **no** consulta la documentación.
3. **Given** el mismo agente, **When** el cliente saluda o confirma algo ya acordado, **Then** el agente
   responde sin consultar la documentación.
4. **Given** el mismo agente, **When** el cliente pregunta algo que no está en ningún documento, **Then** el
   agente dice que no cuenta con esa información en vez de inventar una respuesta.
5. **Given** una pregunta ya respondida antes en la misma conversación, **When** el cliente la repite,
   **Then** el agente responde con lo que ya está en la conversación, sin volver a consultar la documentación.
6. **Given** cualquier búsqueda realizada, **When** el responsable abre el registro de consumo de IA,
   **Then** encuentra una entrada identificada como búsqueda documental, con sus tokens de entrada y salida y
   su costo estimado, atribuida a su propio comercio.
7. **Given** una búsqueda que falla por un error del servicio, **When** ocurre, **Then** queda registrada
   como fallida y el agente responde igual, sin romper la conversación.
8. **Given** un agente **sin** documentación cargada, **When** atiende una conversación, **Then** se comporta
   exactamente como antes de esta feature: no intenta consultar documentación ni menciona que pueda hacerlo.

---

### User Story 3 - Recuperarse de los casos que salen mal (Priority: P3)

La documentación de un comercio tiene que seguir siendo confiable cuando algo falla: un archivo que no se
pudo indexar, documentos cargados con el mecanismo anterior que ya no sirven, o un entorno donde la
funcionalidad todavía no está habilitada. El responsable siempre entiende qué pasó y qué puede hacer.

**Why this priority**: Son escenarios de borde, no el camino feliz. La feature entrega valor sin ellos, pero
sin ellos genera confusión y costos silenciosos en producción.

**Independent Test**: Se prueba provocando cada condición por separado (indexación fallida, documentos
heredados presentes, configuración ausente) y verificando que la interfaz lo comunica y ofrece una salida.

**Acceptance Scenarios**:

1. **Given** un archivo cuya indexación falló, **When** el responsable mira la lista, **Then** ve el estado
   de error con su motivo y puede reintentar sin volver a subir el archivo.
2. **Given** un agente con documentos cargados por el mecanismo anterior, **When** el responsable abre la
   sección, **Then** los ve listados como "Requiere resubir", entiende que el agente ya no los usa, y puede
   eliminarlos.
3. **Given** un entorno donde la búsqueda documental no está habilitada, **When** el responsable abre la
   sección, **Then** ve un mensaje que lo explica en vez de un botón de carga que fallaría.
4. **Given** un borrado que falló a mitad de camino, **When** se ejecuta la conciliación periódica, **Then**
   los archivos que ya no corresponden a ningún documento vigente se eliminan del servicio de indexación.

---

### Edge Cases

- **PDF escaneado (fotos de páginas, sin texto seleccionable)**: se rechaza en el momento de la carga con un
  mensaje que explica el problema, antes de incurrir en ningún costo de indexación.
- **Archivo que supera el tamaño máximo**: se rechaza indicando el límite.
- **Se alcanzó el máximo de documentos por agente**: se indica el límite y que hay que eliminar uno para
  subir otro.
- **La indexación tarda más de lo esperado**: el documento queda en estado "Indexando" y la lista lo refleja;
  no se bloquea la interfaz ni se pierde el archivo.
- **Un fragmento recuperado no pertenece al comercio que consultó**: la respuesta completa se descarta, se
  registra una alerta de seguridad y el agente responde como si no hubiera encontrado nada. **Bajo ninguna
  circunstancia ese contenido llega al cliente.**
- **Dos comercios suben un archivo con el mismo nombre**: conviven sin colisionar y cada uno solo accede al
  suyo.
- **El agente consulta la documentación y la búsqueda excede el tiempo de espera**: se trata como "no
  encontré nada", la conversación continúa, y el intento queda registrado.
- **Se elimina el agente completo**: sus documentos dejan de existir para el sistema y sus archivos quedan
  alcanzados por la conciliación de huérfanos. El índice de la cuenta sobrevive, porque puede tener
  documentos de otros agentes.
- **Dos cargas simultáneas en una cuenta que todavía no tiene índice**: se crea uno solo. El sistema no puede
  terminar con dos índices y la mitad de los documentos en el que nadie consulta.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Carga y gestión de documentos

- **FR-001**: El sistema MUST permitir al responsable del negocio subir documentos a un agente, hasta un
  máximo de 20 archivos de 25 MB cada uno.
- **FR-002**: El sistema MUST aceptar todos los formatos de documento que el servicio de indexación admite
  (PDF, Word, PowerPoint, texto plano, Markdown, JSON, HTML y archivos de código) y MUST rechazar los
  formatos de imagen (PNG, SVG, JPG) con un mensaje que explique el motivo y la alternativa.
- **FR-003**: El sistema MUST validar formato y tamaño en el servidor, independientemente de cualquier
  validación realizada en el navegador.
- **FR-004**: El sistema MUST rechazar, en el momento de la carga, un PDF sin texto extraíble, explicando que
  un documento escaneado no puede indexarse.
- **FR-005**: El sistema MUST indexar el documento íntegro, sin resumirlo, recortarlo ni transformarlo.
- **FR-006**: El sistema MUST NOT inyectar el contenido de ningún documento en el contexto del agente.
- **FR-007**: El sistema MUST conservar una copia del archivo original para poder reindexarlo sin pedirle al
  negocio que lo vuelva a subir.
- **FR-008**: El sistema MUST permitir desactivar un documento sin eliminarlo; un documento desactivado
  MUST NOT ser consultable por el agente.
- **FR-009**: Al eliminar un documento, el sistema MUST borrarlo del índice **y** borrar el archivo del
  servicio de indexación — desindexarlo no es suficiente — además de eliminar la copia local y el registro.
- **FR-010**: El sistema MUST reflejar el estado de cada documento (indexando, listo, error) y MUST permitir
  reintentar una indexación fallida sin volver a subir el archivo.

#### Aislamiento entre cuentas y entre agentes (NO NEGOCIABLE)

> Cada comercio tiene su propio índice, así que el aislamiento entre cuentas es primero físico. Los
> requisitos de abajo son, entre comercios, defensa en profundidad; y dentro de una misma cuenta, lo único
> que separa la documentación de un agente de la de otro.

- **FR-011**: Cada documento indexado MUST llevar la identidad de su comercio y de su agente
  (`instanciaId_agenteId_documentoId`) tanto en su nombre como en sus atributos consultables.
- **FR-012**: Toda búsqueda documental MUST aplicar obligatoriamente un filtro por comercio y agente. El
  filtro MUST ser construido por el sistema a partir del contexto autenticado del servidor, y MUST NOT poder
  ser provisto, modificado ni omitido por quien invoca la búsqueda — incluido el modelo de IA.
- **FR-013**: El sistema MUST verificar, sobre los fragmentos efectivamente devueltos por una búsqueda, que
  todos pertenecen al comercio y agente que consultaron. Si alguno no pertenece, el sistema MUST descartar la
  respuesta completa, registrar una alerta de seguridad y devolver un resultado vacío.
- **FR-014**: Un fragmento sin identidad verificable MUST tratarse como ajeno y descartarse. La ausencia de
  atributos no puede ser una vía de acceso.
- **FR-015**: Los identificadores internos del servicio de indexación MUST NOT ser enviados al navegador bajo
  ninguna forma. Lo único que el frontend recibe de un documento es su nombre, extensión, tamaño, estado,
  si está activo y cuándo se cargó.

#### Consulta por parte del agente

- **FR-016**: El agente MUST disponer de una capacidad de búsqueda documental, y MUST decidir él mismo cuándo
  usarla.
- **FR-017**: El sistema MUST instruir al agente con esta política de consulta:
  - usar la conversación y el contexto de Karia para saludos, confirmaciones y preguntas ya contestadas;
  - consultar la documentación cuando el cliente pregunte por información estable del comercio (políticas,
    métodos generales de envío, retiro, materiales, cuidados) que no aparezca ya en la conversación;
  - usar las herramientas y datos vigentes de Karia —nunca la documentación— para precios, inventario,
    pedidos y tarifas actuales;
  - no consultar la documentación en cada mensaje, sino solo cuando la respuesta dependa de información
    específica del comercio que todavía no tiene;
  - si busca y no encuentra una respuesta clara, decirlo y no inventarla.
- **FR-018**: La búsqueda MUST devolver un resultado explícito de "no encontrado" cuando no haya coincidencias
  claras, para que el agente pueda decirlo en lugar de improvisar.
- **FR-019**: El sistema MUST ofrecer la capacidad de búsqueda documental **únicamente** a los agentes que
  tienen al menos un documento indexado y activo. Un agente sin documentación MUST comportarse exactamente
  como antes de esta feature.
- **FR-020**: Una búsqueda que falla o excede su tiempo de espera MUST tratarse como "no encontrado" y MUST
  NOT interrumpir la respuesta al cliente.
- **FR-021**: El sistema MUST aislar los tipos y errores propios del proveedor externo detrás de un contrato
  interno; la lógica del agente MUST NOT depender de ellos (Constitución, Principio IV).

#### Contabilización del consumo

- **FR-022**: El sistema MUST registrar cada búsqueda documental en el registro de uso de IA, como una tarea
  identificable y distinguible de las demás.
- **FR-023**: El registro MUST usar los tokens de entrada y salida **reportados por el proveedor**, nunca
  valores estimados ni inventados.
- **FR-024**: El costo estimado de cada búsqueda MUST incluir tanto el costo de los tokens como la tarifa por
  llamada de búsqueda documental. Si no hay tarifas configuradas, el costo MUST quedar vacío en lugar de
  registrar un número incorrecto.
- **FR-025**: Cada registro MUST quedar atribuido al comercio, al agente y a la versión publicada del agente
  que originó la búsqueda, y MUST poder rastrearse hasta la conversación que la disparó.
- **FR-026**: Una búsqueda fallida MUST quedar registrada como fallida, con su motivo y con tokens en cero.
- **FR-027**: El sistema MUST NOT registrar consumo de tokens por la carga o indexación de un documento: ese
  costo no se mide en tokens y registrarlo como tal falsearía la auditoría.

#### Interfaz

- **FR-028**: La lista de documentos MUST mostrar, de cada archivo, **solo su nombre**, su estado, si está
  activo y la opción de eliminarlo. MUST NOT ofrecer edición del contenido en línea, acción de entrenamiento,
  ni previsualización del texto.
- **FR-029**: Subir, eliminar y activar/desactivar un documento MUST tener efecto inmediato, sin depender de
  guardar el formulario del agente.
- **FR-030**: Cuando la búsqueda documental no esté habilitada en el entorno, la interfaz MUST explicarlo en
  lugar de ofrecer una carga que fallaría.

#### Compatibilidad y migración

- **FR-031**: Los documentos cargados con el mecanismo anterior MUST listarse como "Requiere resubir", MUST
  NOT ser consultables y MUST poder eliminarse.
- **FR-032**: Esta feature MUST NOT alterar el comportamiento de ningún agente que no tenga documentación
  cargada, ni el de ninguna otra capa del contexto, herramienta operativa o flujo de venta existente.
- **FR-033**: El versionado y la restauración de versiones del perfil del agente MUST seguir funcionando
  igual; la documentación cargada MUST NOT verse alterada al publicar o restaurar una versión.

### Key Entities

- **Documento del agente**: un archivo que el comercio cargó para que su agente lo consulte. Tiene nombre
  visible, formato, tamaño, estado de indexación y si está activo. Pertenece a un agente y a un comercio.
  Guarda además, de forma estrictamente interna, dónde vive su copia original y su identidad en el servicio
  de indexación.
- **Registro de uso de IA** *(existente, se extiende)*: suma un tipo de tarea nuevo —búsqueda documental— con
  sus tokens, costo y trazabilidad al comercio, agente, versión del agente y conversación.
- **Configuración del agente** *(existente, se modifica)*: deja de almacenar el texto resumido de los
  documentos; el campo heredado queda solo para poder listar lo anterior como "Requiere resubir".

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El responsable del negocio carga un documento y lo ve disponible para consulta en menos de 60
  segundos, sin ejecutar ninguna acción adicional de preparación.
- **SC-002**: El agente responde correctamente preguntas cuya respuesta está en cualquier parte de un
  documento largo, incluyendo partes que el mecanismo anterior perdía al resumir.
- **SC-003**: En una batería de 20 conversaciones representativas, el agente consulta la documentación en el
  100% de los casos donde la respuesta solo está ahí, y en 0% de los saludos, confirmaciones y consultas de
  precio o stock.
- **SC-004**: El agente nunca presenta como propia una respuesta que no encontró: ante una pregunta sin
  respaldo documental, dice que no cuenta con esa información en el 100% de los casos.
- **SC-005**: Cero cruces entre comercios: en pruebas con documentación contradictoria entre dos cuentas,
  cada agente responde exclusivamente con la suya, en el 100% de los intentos.
- **SC-006**: El 100% de las búsquedas realizadas aparece en el registro de consumo de IA con sus tokens y su
  costo, atribuidas al comercio correcto.
- **SC-007**: Al eliminar un documento, queda cero rastro de él: no es consultable, no está en el índice y no
  está en el servicio de indexación.
- **SC-008**: Un agente sin documentación cargada produce exactamente las mismas respuestas que antes de esta
  feature, verificable por regresión.
- **SC-009**: El consumo de contexto por mensaje de un agente con documentación cargada es menor que antes de
  esta feature, porque el contenido de los documentos ya no viaja en cada respuesta.
- **SC-010**: El responsable puede cargar al menos 20 documentos y al menos 8 formatos distintos, frente a
  los 3 documentos y 2 formatos anteriores.

---

## Assumptions

- **Alcance del índice**: cada comercio tiene su propio índice documental, creado automáticamente la primera
  vez que sube un documento. El índice de un comercio no contiene datos de otro. Dentro de la cuenta, cada
  documento pertenece a un agente, y esa separación sí es lógica: la sostienen los FR-011 a FR-015, que
  siguen siendo no negociables — son además defensa en profundidad entre comercios.
- **Credenciales**: todos los índices viven en la cuenta del proveedor que opera **Karia**, no en la de cada
  comercio. Es deliberado: un comercio cuyo agente corre sobre otro proveedor de IA no tiene credencial de
  este servicio y se quedaría sin documentación. Con la credencial de la plataforma, la funcionalidad está
  disponible para toda cuenta.
- **Atribución de costos**: Karia le paga al proveedor; el registro de uso de IA sigue atribuyendo el consumo
  a cada comercio, que es lo que permite medir, limitar y facturar.
- **Techo de escala**: el servicio de indexación admite 10.000 archivos por índice. Como cada comercio tiene
  el suyo, el límite aplica por cuenta: con 20 documentos por agente, una cuenta con cinco agentes usa 100.
  Es inalcanzable en la práctica.
- **Formatos de imagen fuera de alcance**: el servicio de indexación no admite imágenes. Transcribirlas con
  un modelo de visión para luego indexarlas es una capacidad distinta y queda explícitamente fuera de alcance.
- **Sin migración automática**: los documentos del mecanismo anterior no se reindexan automáticamente. El
  negocio los vuelve a subir (decisión tomada).
- **Límites elegidos**: 20 documentos por agente y 25 MB por archivo. El servicio admite mucho más; estos
  valores responden al producto y al costo, y son ajustables sin cambios de arquitectura.
- **Latencia aceptable**: una búsqueda documental agrega una llamada de red al turno del agente. Se asume
  aceptable para las consultas donde aplica, y se acota con un tiempo de espera que degrada a "no encontré"
  en vez de fallar.
- **Permisos reutilizados**: gestionar documentación requiere el mismo permiso que ya rige la configuración
  de IA; no se introduce un permiso nuevo.
