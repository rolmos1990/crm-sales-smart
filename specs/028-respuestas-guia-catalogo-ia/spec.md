# Feature Specification: Respuestas guía por intención y catálogo con precios para el agente de IA

**Feature Branch**: `[028-respuestas-guia-catalogo-ia]`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "El negocio necesita controlar el formato de las respuestas automáticas de la IA por intención del cliente (precio, disponibilidad, envío, pago, saludo, otra) y que la IA conozca el catálogo activo con sus precios reales para no preguntar genéricamente ni inventar precios. Caso real: un cliente escribió 'Buenas tardes, precio por favor' y la IA respondió '¿Me confirmas qué producto o servicio necesitas y la cantidad?'. Alcance: respuestas guía por intención versionadas en el agente; catálogo vigente con precios en el contexto con toggle por agente; ajustar la regla fija de precios para que el catálogo cuente como información real; aviso en la etapa del pipeline cuando la IA está habilitada sin agente. No alterar el comportamiento existente."

## Clasificación

**Feature**, no Hotfix. Karia nunca tuvo formatos de respuesta por intención ni catálogo en el contexto de la IA. La respuesta genérica del caso real no es un fallo de algo que se prometía: la instancia no tenía agente configurado y, aun con agente, la capacidad no existía.

## Decisiones de diseño ya acordadas

Estas decisiones se tomaron con el usuario antes de escribir el spec y **no** son supuestos del agente. Se registran acá para que `/speckit-plan` las herede sin re-litigarlas.

1. **"Precio conocido" = catálogo de productos.** Los precios que la IA debe usar son los ya cargados en Productos. No hay un precio único por cuenta ni por canal.
2. **Alcance: respuestas guía + catálogo.** Se descartó resolverlo solo con reglas de texto libre, y también la variante de solo plantillas sin catálogo.
3. **Versionado.** Las respuestas guía y la configuración del catálogo forman parte del perfil del agente y siguen el mismo ciclo de borrador → publicación → restauración que el resto del perfil.
4. **La regla anti-invención se mantiene.** La IA puede dar precios del catálogo del contexto o de las herramientas, pero nunca inventar uno.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El cliente pregunta el precio y recibe precios reales (Priority: P1)

Un cliente escribe "precio por favor" sin nombrar producto. En vez de preguntarle qué necesita, el agente responde con los precios reales del catálogo:
- si el catálogo es corto, todos;
- si es largo, los principales, y pregunta cuál le interesa.

Cuando el cliente nombra un producto, el agente responde con el precio real de ese producto.

**Why this priority**: es el caso real que motivó la feature y el de mayor impacto comercial. Una pregunta genérica ante "precio" hace perder al cliente.

**Independent Test**: con un agente con el catálogo activado y productos con precio cargado, enviar "precio por favor" en el simulador del agente. La respuesta contiene al menos un precio del catálogo con su moneda y ningún precio que no esté en Productos.

**Acceptance Scenarios**:

1. **Given** un agente con "Incluir catálogo con precios" activo y 5 productos activos con precio, **When** el cliente escribe "precio por favor", **Then** la respuesta menciona precios de esos productos con su moneda, sin preguntar antes qué producto necesita.
2. **Given** el mismo agente y un catálogo de 200 productos, **When** el cliente escribe "precio por favor", **Then** la respuesta ofrece como máximo tres opciones con su precio y pregunta cuál le interesa.
3. **Given** un cliente que pregunta por un producto que no existe en el catálogo, **When** el agente responde, **Then** no da un precio para ese producto: dice que no lo tiene o busca alternativas reales.
4. **Given** un producto activo con precio 0, **When** el agente arma su respuesta, **Then** no lo ofrece como si tuviera precio.

---

### User Story 2 - El negocio define cómo se responde cada tipo de consulta (Priority: P1)

El dueño o administrador configura en el agente respuestas guía por intención: precio, disponibilidad, envío, pago, saludo u otra. Cada una tiene:
- **cuándo aplica**, p. ej. "el cliente pregunta el precio sin nombrar producto";
- **un formato**, p. ej. "¡Hola {nombreCliente}! El {producto} está a {precio} {moneda}. ¿Te lo separo?".

Cuando el cliente hace esa consulta, el agente responde siguiendo el formato, adaptado con naturalidad y completado con datos reales.

**Why this priority**: es el control que pidió el negocio ("indicar los formatos de respuesta que necesito"). Sin él, el catálogo solo resuelve el dato, no el estilo ni el llamado a la acción.

**Independent Test**: crear una respuesta guía de PRECIO con un formato reconocible, publicarla y enviar "precio por favor" en el simulador. La respuesta respeta la estructura y el llamado a la acción del formato.

**Acceptance Scenarios**:

1. **Given** un agente con una respuesta guía PRECIO activa, **When** el cliente pregunta el precio, **Then** la respuesta sigue la estructura del formato y reemplaza los marcadores por datos reales.
2. **Given** una respuesta guía inactiva, **When** el cliente hace esa consulta, **Then** el agente no la aplica.
3. **Given** un formato con {precio} y ningún dato de precio disponible, **When** el agente responde, **Then** no inventa el valor ni deja el marcador literal: sigue el formato sin ese dato o pregunta lo necesario.
4. **Given** respuestas guía guardadas como borrador sin publicar, **When** llega un mensaje, **Then** el agente sigue respondiendo con la versión publicada.
5. **Given** una versión anterior restaurada, **When** llega un mensaje, **Then** el agente usa las respuestas guía de esa versión.

---

### User Story 3 - Saber que la IA está activa sin agente configurado (Priority: P2)

Al configurar una etapa del pipeline con respuesta de IA habilitada, el administrador ve un aviso si no hay ningún agente que vaya a atenderla, ni asignado a la etapa ni Comercial en la empresa. El aviso explica que la IA responderá con un perfil mínimo, sin catálogo ni reglas.

**Why this priority**: fue la causa directa del caso real y hoy es invisible. No bloquea nada, pero evita horas de diagnóstico.

**Independent Test**: en una empresa sin agentes, habilitar la IA en una etapa y verificar que aparece el aviso. Crear el agente y verificar que desaparece.

**Acceptance Scenarios**:

1. **Given** una empresa sin agentes, **When** el administrador habilita la IA en una etapa, **Then** ve el aviso con la acción sugerida (crear o asignar un agente).
2. **Given** una etapa con agente asignado, o una empresa con agente Comercial, **When** se abre la configuración de la etapa, **Then** no se muestra el aviso.
3. **Given** el aviso visible, **When** el administrador guarda igual, **Then** la etapa se guarda y la IA responde como hoy: el aviso no bloquea.

---

### Edge Cases

- **Catálogo vacío** o sin productos con precio: no se agrega la sección de catálogo, y el agente no promete precios.
- **Productos de la empresa y de otras empresas:** solo se usan los de la empresa del agente, nunca los de otra.
- **Monedas mezcladas:** cada precio se muestra con su propia moneda.
- **Fallo al leer el catálogo:** el agente responde igual, sin la sección de catálogo. El fallo no bloquea la respuesta.
- **Catálogo desactivado en el agente:** el comportamiento es idéntico al actual respecto de precios.
- **Muchas respuestas guía para la misma intención:** se incluyen todas las activas con su "cuándo aplica" para que el agente elija la adecuada.
- **Formato con marcadores desconocidos** (p. ej. {descuento}): se acepta como texto y el agente no inventa su valor.
- **Agente sin respuestas guía:** instrucciones idénticas a las actuales.
- **Empresa sin agente:** la respuesta automática sigue funcionando exactamente como hoy, con el perfil mínimo.

## Requirements *(mandatory)*

### Functional Requirements

**Respuestas guía**

- **FR-001**: El administrador MUST poder crear, editar, activar/desactivar y eliminar respuestas guía en la configuración de cada agente.
- **FR-002**: Cada respuesta guía MUST tener: intención (Precio, Disponibilidad, Envío, Pago, Saludo, Otra), "cuándo aplica" (texto breve, obligatorio), formato (texto, obligatorio) y estado activa/inactiva.
- **FR-003**: Un agente MUST admitir hasta 15 respuestas guía. Cada formato admite hasta 1000 caracteres y cada "cuándo aplica" hasta 200. El servidor MUST rechazar valores fuera de esos límites.
- **FR-004**: El formato MUST admitir los marcadores {nombreCliente}, {producto}, {precio} y {moneda}. La interfaz MUST mostrarlos como ayuda para insertarlos.
- **FR-005**: Al generar una respuesta, el agente MUST recibir solo las respuestas guía activas, con la instrucción de seguir el formato adaptado con naturalidad, completar los marcadores únicamente con datos reales y no inventar valores.
- **FR-006**: Las respuestas guía MUST versionarse con el resto del perfil del agente: guardarse en borrador, aplicarse al publicar y recuperarse al restaurar una versión.

**Catálogo en el contexto**

- **FR-007**: Cada agente MUST tener la opción "Incluir catálogo con precios en las respuestas", activa por defecto, y un límite de productos a incluir (por defecto 30, entre 1 y 100).
- **FR-008**: Con la opción activa, el agente MUST recibir la lista de productos activos de su empresa con precio mayor a 0, hasta el límite: nombre, código si existe, precio, moneda, unidad y categoría si existe.
- **FR-009**: Si la empresa tiene más productos que el límite, el agente MUST ser informado de que hay más productos y de que puede buscarlos.
- **FR-010**: Con la opción activa, el agente MUST poder buscar productos del catálogo aunque "Acceso a Productos" no esté marcado en sus capacidades.
- **FR-011**: Un fallo al obtener el catálogo MUST NOT impedir la respuesta; el agente responde sin esa sección.
- **FR-012**: El catálogo MUST limitarse estrictamente a la empresa del agente.

**Regla de precios**

- **FR-013**: La regla fija de comportamiento sobre precios MUST permitir dar precios que aparezcan en el catálogo del contexto o en el resultado de una búsqueda, y MUST seguir prohibiendo inventar precios, disponibilidad o fechas.
- **FR-014**: Ante una consulta de precio sin producto, la regla MUST indicar responder con los precios si el catálogo es corto, u ofrecer como máximo tres opciones con precio y preguntar cuál interesa si es largo.

**Aviso sin agente**

- **FR-015**: La configuración de etapa del pipeline MUST mostrar un aviso cuando la respuesta de IA está habilitada, la etapa no tiene agente asignado y la empresa no tiene agente Comercial.
- **FR-016**: El aviso MUST NOT bloquear el guardado ni cambiar cómo responde la IA.

**No alterar lo existente**

- **FR-017**: Un agente sin respuestas guía y con el catálogo desactivado MUST recibir exactamente las mismas instrucciones que hoy, salvo el ajuste de la regla de precios (FR-013/FR-014).
- **FR-018**: La respuesta automática para empresas sin agente MUST seguir funcionando exactamente como hoy.
- **FR-019**: El orden en que se combinan las secciones de instrucciones existentes (identidad, tono, reglas, estrategia, perfil del cliente, ejemplos, contexto dinámico, instrucciones libres, seguridad) MUST mantenerse. Las respuestas guía se ubican inmediatamente después de "Reglas del negocio", y el catálogo en la sección reservada de información operativa verificada.

### Key Entities

- **Respuesta guía**: pertenece a un agente. Tiene intención, cuándo aplica, formato con marcadores y estado activa. Se versiona con el perfil del agente.
- **Configuración de catálogo del agente**: si el catálogo se incluye y con qué límite. Se versiona con el perfil.
- **Producto** (existente): nombre, código, precio, moneda, unidad, categoría, activo y empresa. Es la única fuente de precios.
- **Agente de IA** (existente): perfil versionado al que se agregan los dos elementos anteriores.
- **Etapa del pipeline** (existente): respuesta de IA habilitada y agente asignado. Solo se agrega el aviso visual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ante "precio por favor" en una empresa con catálogo cargado y agente configurado, 9 de cada 10 respuestas del simulador incluyen al menos un precio real con moneda y ninguna pregunta genérica de "qué producto necesitas" como único contenido.
- **SC-002**: 0 respuestas con un precio que no exista en el catálogo de la empresa, en una batería de al menos 20 consultas de prueba que incluya productos inexistentes.
- **SC-003**: Con una respuesta guía PRECIO activa, 9 de cada 10 respuestas a consultas de precio conservan su estructura y su llamado a la acción.
- **SC-004**: Un administrador configura una respuesta guía y la ve aplicada en el simulador en menos de 3 minutos.
- **SC-005**: El 100% de las etapas con IA habilitada y sin agente disponible muestran el aviso. Ninguna etapa con agente disponible lo muestra.
- **SC-006**: Agentes existentes sin respuestas guía ni catálogo mantienen el mismo comportamiento: las pruebas de regresión del armado de instrucciones pasan sin cambios, salvo la regla de precios.

## Assumptions

- **"Principales" productos:** para el límite se priorizan los productos actualizados más recientemente, porque no existe un campo de "destacado". Podrá refinarse con uno en el futuro.
- **Agentes existentes:** reciben el catálogo activado por defecto al migrar. Es el comportamiento deseado para resolver el caso real. Quien no lo quiera puede desactivarlo.
- **Costo:** el catálogo agrega texto a cada respuesta. Con el límite por defecto (30), el aumento es acotado y aceptable frente al límite diario de tokens ya existente.
- **Marcadores:** no se reemplazan de forma determinista antes de enviar. El agente los completa al redactar con datos del catálogo o de las herramientas. No se agregan marcadores más allá de los cuatro definidos.
- **Clasificación de intención:** no hace falta un clasificador nuevo. El agente elige qué respuesta guía aplica a partir de su "cuándo aplica" y la conversación.
- **Fuera de alcance:** listas de precios por cliente o canal, precios por variante, promociones, respuestas guía a nivel empresa compartidas entre agentes, y crear agentes automáticamente cuando no existen.
