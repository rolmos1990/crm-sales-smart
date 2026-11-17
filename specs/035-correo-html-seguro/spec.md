# Feature Specification: Vista segura de correos HTML en el Inbox

**Feature Branch**: `feature/035-correo-html-seguro`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "035 — Vista segura de correos HTML en el Inbox. Que los correos entrantes que traen HTML se vean tal cual los diseñó el remitente (estilo Gmail/Outlook) dentro del panel central del Inbox cuando el canal es email, con prioridad absoluta en proteger Karia, sus sesiones, usuarios, comercios y datos. No alterar WhatsApp, Instagram ni Messenger, ni la IA/búsqueda/vista previa de lista, que siguen usando el texto plano. Origen: misma app por ahora, iframe aislado sin scripts ni mismo origen, CSP restrictiva por cabecera. Imágenes externas bloqueadas por defecto, con carga opcional mediante un proxy con protección SSRF. Alcance: solo visualización; responder a todos, reenviar, CC saliente y editor enriquecido quedan para una feature posterior. Sanitización en el backend al recibir, guardando solo el HTML ya limpio." (texto completo en el historial de la conversación que originó esta feature).

> **Por qué es Feature y no Hotfix**: Karia nunca mostró el HTML de un correo. No es un defecto: fue una
> decisión de seguridad explícita de la feature 034 (`specs/034-canal-correo-electronico/research.md`,
> R10; `CLAUDE.md` §9; fijada por el test `normalizar.test.ts` "un correo HTML se guarda como texto
> legible, nunca como HTML"). Esta feature **revierte esa decisión de forma controlada**: agrega una
> capacidad nueva y reemplaza la regla "nunca se renderiza" por una regla más precisa — "solo se muestra
> sanitizado y aislado, nunca dentro de la página de Karia". Ver `docs/SPEC-KIT-WORKFLOWS.md`.

---

## Contexto del cambio

La feature 034 incorporó el correo como canal de atención y, sobre esa base, la vista de hilo de correo
(rama `fix/vista-correo-inbox`) ya muestra cada correo como una tarjeta plegable con su texto. El problema
es que buena parte del correo comercial real —bancos, proveedores, plataformas, boletines, formularios de
sitios web— se diseña en HTML: logos, tablas, botones, listas numeradas con estilo. Reducido a texto, ese
correo pierde estructura y a veces se vuelve ilegible, y el agente termina abriendo el buzón original fuera
de Karia para entender qué le escribieron.

Mostrar HTML de terceros es, a la vez, la superficie de ataque más conocida del correo:

1. **Ejecución de código en Karia (XSS).** Un correo puede traer código o atributos que, si se insertan en
   la página, se ejecutan con la sesión del agente: leen la conversación de otros clientes, llaman a la API
   como si fueran el agente o roban la sesión.
2. **Suplantación visual.** HTML y estilos que imitan la interfaz de Karia (un "inicie sesión de nuevo", un
   botón falso) dentro del panel del Inbox.
3. **Rastreo y peticiones no autorizadas.** Imágenes remotas que avisan al remitente cuándo y desde dónde se
   abrió el correo, o que hacen que el navegador del agente consulte direcciones arbitrarias.
4. **Agotamiento de recursos.** Correos gigantes o anidados a propósito para colgar el procesamiento.

Por eso esta feature no es "mostrar el HTML": es mostrar **una versión limpia del HTML**, en un espacio que
**no puede tocar nada de Karia** aunque la limpieza fallara.

## Diagnóstico del estado actual

Confirmado en el código antes de definir el alcance:

- **El HTML se descarta al recibir.** `src/integraciones/email/mensaje/normalizar.ts` usa solo el texto que
  deriva el parser de correo; el HTML nunca llega a la base de datos. En consecuencia, **los correos ya
  recibidos no pueden mostrarse con formato**: solo se verán así los que lleguen después de esta feature.
- **No hay cabeceras por mensaje.** De, Para y CC no se guardan; solo existe el asunto a nivel de
  conversación (`Conversacion.asunto`). El hilo hoy deduce "De" y "Para" del contacto y del buzón.
- **El adjunto principal** de cada correo se guarda por el servicio de media existente; los demás quedan
  listados por nombre dentro del texto. Las imágenes incrustadas en el cuerpo (referenciadas por
  identificador de contenido, "cid") no se vinculan a nada.
- **El aislamiento por comercio** ya existe en la lectura de mensajes: la ruta de mensajes de una
  conversación verifica que la conversación pertenezca al comercio de la sesión.
- **El procesamiento de correo corre en el worker**, que tiene restricciones propias sobre qué módulos
  puede cargar (cubierto por `src/worker/grafo-importaciones.test.ts`).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leer un correo HTML con su formato original, de forma segura (Priority: P1)

Un agente abre en el Inbox una conversación de correo. El correo más reciente llegó en HTML (por ejemplo,
el aviso de un banco con logo, pasos numerados y un recuadro destacado). En la tarjeta expandida el agente
ve el correo con su diseño original sobre una "hoja" clara, puede desplazarse dentro del cuerpo sin ver una
barra de desplazamiento tosca, y puede cambiar a "Texto plano" para leerlo o copiarlo sin formato. Nada de
lo que trae ese correo puede ejecutarse, salir del recuadro ni tocar la sesión, los datos ni la interfaz de
Karia.

**Why this priority**: Es el valor de la feature y, a la vez, su riesgo principal. Sin la vista segura no
hay nada que mostrar; con una vista insegura, la feature es una vulnerabilidad. Todo lo demás depende de
esto.

**Independent Test**: Recibir en un buzón conectado un correo HTML normal y uno malicioso (con código,
atributos de evento, enlaces peligrosos, formularios y estilos que imitan la interfaz). Abrirlos en el
Inbox y comprobar que el normal se ve con formato, que el malicioso se ve sin nada ejecutable, y que en
ningún caso el contenido accede a la sesión, a las APIs de Karia ni navega la ventana principal.

**Acceptance Scenarios**:

1. **Given** un correo recibido después de esta feature que trae una versión HTML, **When** el agente
   expande su tarjeta, **Then** ve el cuerpo con su formato (textos, colores, tablas, listas, imágenes
   incrustadas) y la opción "Vista previa (HTML)" seleccionada.
2. **Given** un correo con versión HTML, **When** el agente elige "Texto plano", **Then** ve el texto del
   correo con sus saltos de línea, seleccionable y copiable, sin ninguna etiqueta interpretada.
3. **Given** un correo cuyo HTML contiene código ejecutable, atributos de evento, formularios, marcos
   incrustados, objetos o enlaces con protocolos peligrosos, **When** se muestra, **Then** ninguno de esos
   elementos está presente ni produce efecto, y el resto del contenido seguro se ve normalmente.
4. **Given** un correo mostrado en vista previa, **When** su contenido intenta leer cookies o
   almacenamiento, llamar a una API de Karia, abrir ventanas, enviar formularios o cambiar la página
   principal, **Then** todos esos intentos fallan y la página de Karia no cambia.
5. **Given** un correo que solo trae texto (sin HTML), o uno recibido antes de esta feature, **When** el
   agente lo expande, **Then** se muestra en texto como hoy, sin selector de vista ni mensajes de error.
6. **Given** un correo cuyo HTML no pudo limpiarse (malformado al extremo, demasiado grande o demasiado
   anidado), **When** el agente lo expande, **Then** se muestra solo en texto, con un aviso discreto de que
   la vista con formato no está disponible, y el correo no se pierde.
7. **Given** un correo HTML con un enlace normal, **When** el agente lo sigue, **Then** se abre en una
   pestaña nueva, sin que el sitio de destino reciba de qué página venía ni pueda controlar la de Karia.
8. **Given** un agente de otro comercio que conoce o adivina el identificador de un correo ajeno, **When**
   intenta abrir su vista previa, **Then** recibe "no encontrado", sin distinguir si el correo existe.

---

### User Story 2 - Ver las cabeceras reales de cada correo (Priority: P2)

En la tarjeta expandida de cada correo el agente ve quién lo envió (nombre y dirección), a quién iba
dirigido, a quién se copió (CC), la fecha y el asunto de **ese** correo — no los de la conversación —, igual
que en un cliente de correo.

**Why this priority**: En correo B2B importa quién más está en copia (el gerente, el área de compras) y si
el asunto cambió a mitad del hilo. Hoy el hilo lo deduce y puede mostrar datos inexactos. Es independiente
de la vista HTML: aplica también a correos de solo texto.

**Independent Test**: Recibir un correo con varios destinatarios, CC y un asunto distinto al original de la
conversación; comprobar que la tarjeta muestra exactamente esos datos.

**Acceptance Scenarios**:

1. **Given** un correo recibido con remitente, varios destinatarios y CC, **When** el agente expande su
   tarjeta, **Then** ve De (nombre y dirección), Para, CC y fecha tal como venían en el correo.
2. **Given** un hilo en el que un correo cambió el asunto, **When** el agente expande ese correo, **Then** ve
   el asunto de ese correo.
3. **Given** un correo recibido antes de esta feature (sin cabeceras guardadas), **When** se expande,
   **Then** se muestra como hoy: remitente deducido del contacto y "Para" deducido del buzón.
4. **Given** una respuesta enviada desde Karia, **When** se expande, **Then** muestra De = el buzón,
   Para = el cliente y el asunto con que salió.
5. **Given** un correo con una lista muy larga de destinatarios, **When** se expande, **Then** se muestran
   los primeros y un indicador "y N más" que permite ver la lista completa.

---

### User Story 3 - Imágenes externas bloqueadas, cargables bajo control (Priority: P3)

Cuando un correo HTML trae imágenes alojadas fuera (logos, banners, píxeles de rastreo), Karia no las
descarga al abrirlo. El agente ve un aviso discreto — "Este correo contiene imágenes externas que se han
bloqueado por seguridad" — y una acción para cargarlas. Si la usa, las imágenes llegan a través de Karia, que
solo descarga imágenes públicas, nunca direcciones internas, y el remitente no ve la dirección del agente.

**Why this priority**: Sin esto los correos con logos remotos se ven incompletos, pero el bloqueo por
defecto ya protege. La carga controlada es una mejora de lectura con su propio riesgo (que Karia termine
consultando direcciones internas), por eso va separada y después de P1.

**Independent Test**: Recibir un correo con una imagen remota pública, un píxel de rastreo y referencias a
direcciones internas; comprobar que al abrirlo no sale ninguna petición hacia esos destinos, que la acción
carga solo la imagen pública, y que las referencias internas nunca se consultan.

**Acceptance Scenarios**:

1. **Given** un correo HTML con imágenes remotas, **When** el agente lo abre, **Then** ninguna imagen remota
   se solicita, en su lugar hay un espacio neutro, y se muestra el aviso de imágenes bloqueadas.
2. **Given** ese aviso, **When** el agente elige cargar las imágenes, **Then** las imágenes públicas válidas
   se muestran en su lugar, obtenidas por Karia y no directamente por el navegador del agente.
3. **Given** una imagen remota que apunta (directamente, por redirección o por resolución de nombre) a una
   dirección privada, local, de la red interna o de metadatos de la nube, **When** se pide cargarla,
   **Then** Karia no la consulta y la imagen queda como no disponible.
4. **Given** un recurso remoto que no es una imagen admitida (página, script, vectorial, archivo enorme o
   que tarda demasiado), **When** se pide cargarlo, **Then** Karia lo rechaza y la imagen queda como no
   disponible.
5. **Given** un correo con imágenes incrustadas en el propio correo (cid), **When** se abre, **Then** esas
   imágenes se muestran sin necesidad de ninguna acción, porque Karia ya las guardó.
6. **Given** un agente de otro comercio, **When** intenta usar la carga de imágenes con un correo ajeno o con
   una dirección arbitraria que no pertenece a ese correo, **Then** la petición se rechaza.

---

### User Story 4 - Lectura ampliada y adjuntos (Priority: P4)

El agente puede ampliar la lectura de un correo largo a una vista de mayor tamaño sin perder el formato, y
ve los adjuntos del correo como tarjetas con su nombre, tipo y tamaño, que puede descargar.

**Why this priority**: Mejora la comodidad de lectura sobre lo que P1 ya entrega; no agrega protección.

**Independent Test**: Abrir un correo HTML extenso y uno con adjuntos; ampliar la lectura y descargar un
adjunto.

**Acceptance Scenarios**:

1. **Given** un correo expandido, **When** el agente elige ampliar la lectura, **Then** el cuerpo se muestra
   en una vista grande con el mismo nivel de aislamiento, y puede cerrarla para volver al hilo.
2. **Given** un correo con adjuntos guardados, **When** se expande, **Then** se listan con nombre, tipo y
   tamaño, y cada uno se puede descargar.
3. **Given** un adjunto de tipo que podría ejecutarse en el navegador (por ejemplo, HTML o vectorial),
   **When** el agente lo descarga, **Then** se entrega como descarga, nunca abierto dentro de Karia.

---

### Edge Cases

- **Correo solo HTML, sin parte de texto**: el texto plano se deriva del HTML (como hoy) y ambas vistas
  están disponibles.
- **HTML vacío o que queda vacío tras limpiarlo** (por ejemplo, era solo código): se muestra el texto; no se
  ofrece una vista previa en blanco.
- **HTML más grande que el límite admitido**: no se guarda la versión con formato; se muestra el texto con
  el aviso de "vista con formato no disponible".
- **Anidamiento extremo** (miles de niveles): se trata como fallo de limpieza; no puede colgar el
  procesamiento de otros correos.
- **Codificaciones de caracteres raras o declaradas mal**: el texto se muestra legible; si el HTML no se
  puede interpretar, cae a texto.
- **Estilos que intentan salir del recuadro** (posiciones fijas, superposiciones a pantalla completa): no
  pueden cubrir nada fuera del recuadro del correo.
- **Imagen cid sin adjunto guardado** (porque superó el tope de adjuntos o de tamaño): se muestra un
  espacio "imagen no disponible", no un error.
- **Correo reenviado o citado dentro de otro**: se muestra tal cual vino, con la misma limpieza.
- **Modo oscuro de Karia**: el correo se muestra sobre una hoja clara, porque los correos se diseñan para
  fondo claro; el entorno de Karia conserva su tema.
- **Pantalla angosta (móvil)**: el recuadro ocupa el ancho disponible y los correos de ancho fijo se pueden
  desplazar dentro del recuadro, sin desbordar la página.
- **Correo que llega mientras el agente tiene el hilo abierto**: aparece con su vista previa sin recargar.
- **Reproceso de un correo ya recibido** (relectura del buzón): no se duplica su versión con formato ni sus
  cabeceras.

## Requirements *(mandatory)*

> Por tratarse de una feature de seguridad, varios requisitos fijan **restricciones** concretas acordadas
> con el negocio (aislamiento sin scripts ni mismo origen, política de contenido restrictiva). No son
> preferencias de implementación: son el límite que el plan no puede relajar.

### Functional Requirements

**Recepción y limpieza**

- **FR-001**: El sistema MUST conservar, para cada correo entrante que traiga HTML, una versión **limpia**
  de ese HTML, generada en el servidor al recibir el correo. El HTML original sin limpiar MUST NOT
  guardarse ni mostrarse en ningún lugar.
- **FR-002**: La limpieza MUST basarse en una lista de lo permitido (no de lo prohibido) y en un analizador
  de HTML real, nunca en reemplazos por expresiones regulares.
- **FR-003**: La limpieza MUST eliminar como mínimo: código ejecutable; atributos de evento; formularios y
  controles; marcos, objetos e incrustados; gráficos vectoriales y fórmulas incrustadas; metadatos que
  cambian el comportamiento del documento (redirecciones, base de enlaces, hojas externas); y cualquier
  enlace o recurso con protocolo distinto de web segura/no segura y correo (`http`, `https`, `mailto`).
- **FR-004**: La limpieza MUST neutralizar estilos peligrosos (carga de recursos desde estilos, expresiones
  ejecutables, importación de hojas, posicionamiento fijo o superpuesto) y MUST conservar el formato seguro:
  texto, tipografía básica, colores, alineación, tablas, listas, enlaces e imágenes.
- **FR-005**: Todo enlace conservado MUST abrir en una pestaña nueva, sin informar la página de origen y sin
  dar al destino control sobre Karia.
- **FR-006**: Toda imagen remota MUST quedar marcada como bloqueada en la versión limpia (sin dirección
  cargable), y el correo MUST registrar que tiene imágenes externas bloqueadas.
- **FR-007**: La limpieza MUST tener límites de tamaño de entrada, profundidad y tiempo. Si un correo los
  supera o la limpieza falla, el sistema MUST guardar el correo solo como texto, MUST registrar el motivo en
  los logs técnicos (sin el contenido del correo) y MUST NOT bloquear el procesamiento de otros correos.
- **FR-008**: El texto plano del correo MUST seguir guardándose y usándose exactamente como hoy para la IA,
  la búsqueda, la vista previa de la lista y las automatizaciones.
- **FR-009**: El sistema MUST guardar las cabeceras de cada correo entrante: remitente (nombre y dirección),
  destinatarios, copia (CC), fecha de envío y asunto. Para las respuestas enviadas desde Karia MUST guardar
  remitente, destinatario y asunto con que salieron.
- **FR-010**: El sistema MUST vincular cada imagen incrustada (cid) del HTML al adjunto que Karia guardó para
  ese correo, cuando exista.
- **FR-011**: Reprocesar un correo ya recibido MUST NOT duplicar su versión limpia ni sus cabeceras.

**Presentación aislada**

- **FR-012**: La versión limpia MUST mostrarse solo dentro de un espacio aislado del resto de la página:
  sin capacidad de ejecutar código, sin acceso al origen de Karia (cookies, almacenamiento, DOM, APIs), sin
  formularios, sin ventanas emergentes abiertas por el contenido (solo se permite que un clic del agente en
  un enlace abra una pestaña nueva sin vínculo con Karia, ver FR-005) y sin poder navegar la página
  principal. Esta restricción MUST NOT relajarse para mejorar la apariencia de ningún correo.
- **FR-013**: El HTML del correo MUST NOT insertarse nunca dentro de la página de Karia, ni siquiera ya
  limpio.
- **FR-014**: La versión limpia MUST entregarse con una política de contenido restrictiva que, como mínimo,
  prohíba código, conexiones, fuentes, marcos, objetos, formularios y cambio de base de enlaces; permita
  estilos en línea; permita imágenes solo incrustadas o servidas por Karia; restrinja quién puede
  incrustarla al propio Karia; y aplique aislamiento a nivel de respuesta. La respuesta MUST indicar no
  enviar origen, no adivinar tipo de contenido y no almacenarse en cachés compartidas.
- **FR-015**: La entrega de la versión limpia, de las imágenes cid y de la carga de imágenes externas MUST
  exigir sesión válida y MUST verificar que el correo pertenece al comercio de la sesión; ante cualquier
  discrepancia MUST responder "no encontrado".
- **FR-016**: Ningún identificador o credencial del buzón (servidor, usuario, contraseña, tokens) MUST
  aparecer en lo que se envía al navegador.

**Imágenes externas**

- **FR-017**: Las imágenes externas MUST estar bloqueadas por defecto y el agente MUST ver un aviso
  discreto: "Este correo contiene imágenes externas que se han bloqueado por seguridad", con una acción para
  cargarlas en ese correo.
- **FR-018**: La carga de imágenes externas MUST hacerse a través de Karia, solo para direcciones que
  figuren en ese correo, y MUST: aceptar solo `http`/`https`; rechazar cualquier destino que resuelva a una
  dirección privada, local, de enlace local, de la red interna o de metadatos de nube, comprobándolo en el
  momento de la conexión y en cada redirección; limitar número de redirecciones, tamaño y tiempo; aceptar
  solo imágenes de mapa de bits (no vectoriales); y no reenviar cookies ni cabeceras del agente.
- **FR-019**: La decisión de cargar imágenes MUST aplicar solo al correo y a la sesión de lectura actual y MUST
  NOT convertirse en una preferencia permanente en esta feature.

**Interfaz**

- **FR-020**: Cada correo expandido con versión limpia MUST ofrecer el selector "Vista previa (HTML) |
  Texto plano", con "Vista previa" por defecto. Sin versión limpia, MUST mostrarse solo el texto, sin
  selector.
- **FR-021**: La vista de texto MUST mostrarse como texto normal (saltos de línea conservados, seleccionable,
  sin interpretar etiquetas).
- **FR-022**: La vista previa MUST mostrarse sobre una hoja de fondo claro dentro del tema de Karia, con alto
  acotado y desplazamiento interno funcional **sin barra de desplazamiento visible**, y ajustarse al ancho
  del panel en pantallas pequeñas.
- **FR-023**: El agente MUST poder ampliar la lectura de un correo a una vista grande, con el mismo
  aislamiento.
- **FR-024**: Cada correo expandido MUST mostrar De, Para, CC (si hay), fecha y asunto del propio correo
  (FR-009); para correos sin cabeceras guardadas MUST mantener la deducción actual.
- **FR-025**: Los adjuntos guardados del correo MUST listarse con nombre, tipo y tamaño y poder descargarse;
  los de tipo potencialmente ejecutable en el navegador MUST entregarse siempre como descarga.
- **FR-026**: La vista previa MUST tener estados de carga, error y "vista con formato no disponible".
- **FR-027**: El HTML de un correo recibido MUST NOT copiarse ni inyectarse en el compositor de respuesta.

**No regresión**

- **FR-028**: WhatsApp, Instagram y Facebook Messenger MUST conservar exactamente su comportamiento y su
  vista actuales.
- **FR-029**: Los correos recibidos antes de esta feature MUST seguir mostrándose como hoy.
- **FR-030**: El envío de respuestas por correo MUST seguir funcionando exactamente igual (texto, hilo,
  asunto "Re:").
- **FR-031**: La regla de seguridad documentada (`CLAUDE.md` §9, `research.md` R10 de 034 y la
  documentación del canal) MUST actualizarse a: "el HTML entrante solo se muestra limpio, en un espacio
  aislado sin código ni mismo origen y con política de contenido restrictiva; nunca dentro de la página de
  Karia", y el test que fija la regla anterior MUST reemplazarse por pruebas de la nueva.

### Key Entities

- **Correo de un mensaje**: los datos propios de correo de un mensaje de conversación, uno a uno con él y
  perteneciente a un comercio. Contiene la versión limpia del HTML (si hubo y se pudo limpiar), el motivo si
  no se pudo, si tiene imágenes externas bloqueadas, la lista de direcciones externas permitidas para la
  carga controlada, el vínculo de cada imagen cid con su adjunto, y las cabeceras (remitente, destinatarios,
  CC, fecha, asunto). Solo existe para mensajes del canal correo recibidos o enviados después de esta
  feature.
- **Mensaje de conversación** (existente): no cambia; su texto sigue siendo la fuente para IA, búsqueda y
  vista de lista.
- **Adjunto / archivo de media** (existente): fuente de las imágenes cid y de las descargas; mantiene sus
  permisos por comercio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los casos del catálogo de pruebas de seguridad (código, atributos de evento,
  protocolos peligrosos, HTML malformado, estilos y vectoriales peligrosos, rastreo, tamaño extremo,
  navegación fuera del recuadro, llamadas a APIs de Karia, acceso a otro comercio, SSRF) termina sin
  ejecución de código, sin acceso a datos de Karia y sin peticiones a destinos no autorizados, verificado
  también en un navegador real.
- **SC-002**: Un correo HTML comercial típico (logo, tablas, listas, estilos en línea) se reconoce a simple
  vista como el mismo correo que se ve en un cliente de correo convencional, con las imágenes externas como
  única diferencia mientras estén bloqueadas.
- **SC-003**: La vista previa de un correo de tamaño típico aparece en menos de 1 segundo tras expandir la
  tarjeta.
- **SC-004**: Ningún correo, por grande o malformado que sea, retrasa más de 5 segundos el procesamiento de
  los correos que llegan después de él.
- **SC-005**: Al abrir un correo, el número de peticiones a servidores externos al comercio es cero hasta que
  el agente decide cargar las imágenes.
- **SC-006**: Cero diferencias de comportamiento en WhatsApp, Instagram y Messenger, y en el envío de
  correos, comprobado con sus pruebas existentes.
- **SC-007**: El agente puede leer y entender un correo HTML recibido sin salir de Karia en el 100 % de los
  correos con versión limpia disponible.

## Assumptions

- **Sin respaldo hacia atrás**: los correos recibidos antes de esta feature no tienen HTML guardado y no se
  vuelven a descargar del buzón; se ven en texto.
- **Mismo dominio por ahora**: la vista previa se sirve desde la misma aplicación, con aislamiento por el
  navegador y política de contenido. El diseño deja preparado mover la vista previa a un dominio registrable
  distinto, con un permiso de vida corta por correo; eso queda fuera de esta feature hasta que exista el
  dominio.
- **Solo visualización**: responder a todos, reenviar, CC/CCO saliente, editor enriquecido con HTML saliente,
  firmas y borradores en servidor quedan para una feature posterior. CCO de correos recibidos no existe por
  definición (no viaja en el correo recibido).
- **Adjuntos**: se mantienen los topes actuales del canal (cantidad y tamaño por adjunto). Un análisis
  antimalware no existe hoy en Karia y no se agrega en esta feature; los adjuntos siguen sin ejecutarse ni
  abrirse dentro de Karia.
- **La carga de imágenes externas no se recuerda** entre sesiones ni por remitente en esta feature.
- **La IA no ve el HTML**: sigue trabajando con el texto.
- Se reutilizan la vista de hilo de correo y el compositor ya construidos en `fix/vista-correo-inbox`.
