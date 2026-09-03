# Feature Specification: Plantilla de ejemplo para importar destinos y tarifas

**Feature Branch**: `025-plantilla-ejemplo-importacion-destinos`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "al momento de importar un transportista no hay ningun archivo de ejemplo por el cual el usuario se pueda guiar, necesito poder darle una opción de descargar plantilla de ejemplo excel o csv para que el pueda descargar y hacer los cambios necesarios para importar destinos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descargar la plantilla antes de subir el archivo (Priority: P1)

Un usuario que va a importar destinos y tarifas para un transportista entra al primer paso del asistente de importación ("Subir archivo") y, antes de tener un archivo propio armado, descarga una plantilla de ejemplo que muestra exactamente qué columnas necesita el sistema, cuáles son obligatorias y qué formato de dato espera cada una. Completa esa plantilla con los destinos y tarifas reales de su transportista y la vuelve a subir por el mismo asistente.

**Why this priority**: Es el corazón del pedido — sin esto, el usuario sigue teniendo que adivinar el formato por prueba y error (subir, ver errores, corregir, repetir), que es exactamente el problema reportado. Sin esta historia no hay entrega de valor.

**Independent Test**: Puede probarse por completo abriendo el asistente de importación de destinos para cualquier transportista, descargando la plantilla desde el primer paso, y verificando que el archivo descargado abre correctamente y trae las columnas y un ejemplo de fila esperados — sin necesitar ninguna otra historia.

**Acceptance Scenarios**:

1. **Given** el usuario abrió el asistente de importación de destinos y tarifas de un transportista y está en el paso "Subir archivo", **When** hace clic en la opción de descargar plantilla, **Then** el sistema le entrega un archivo descargable con las columnas que el asistente reconoce y al menos una fila de ejemplo con datos de muestra válidos.
2. **Given** el usuario descargó la plantilla, **When** la abre, **Then** puede identificar sin ambigüedad qué columnas son obligatorias y cuáles opcionales, y qué formato de valor espera cada columna (por ejemplo, cómo separar varios alias, que los costos y precios van sin símbolo de moneda, que los tiempos de entrega son números enteros de días).
3. **Given** el usuario completó la plantilla descargada con sus propios destinos y tarifas sin cambiar los encabezados, **When** la sube en el paso "Subir archivo" del mismo asistente, **Then** el sistema la procesa igual que cualquier otro archivo válido, sin errores atribuibles al formato de la plantilla.

---

### User Story 2 - Elegir el formato de la plantilla (CSV o Excel) (Priority: P2)

El usuario elige si quiere descargar la plantilla en formato CSV o en formato Excel, según la herramienta que use habitualmente para editar planillas.

**Why this priority**: Mejora la experiencia y reduce fricción (evita que alguien sin Excel reciba un .xlsx, o que alguien que prefiere Excel reciba un .csv con problemas de acentos/columnas al abrirlo), pero el valor principal (tener una guía de formato) ya se entrega con un solo formato en la Historia 1.

**Independent Test**: Puede probarse ofreciendo ambas opciones de descarga en el paso "Subir archivo" y confirmando que cada una entrega un archivo válido en el formato correspondiente, con el mismo contenido de columnas y ejemplo.

**Acceptance Scenarios**:

1. **Given** el usuario está en el paso "Subir archivo", **When** elige descargar la plantilla en CSV, **Then** recibe un archivo `.csv` con las columnas y la fila de ejemplo.
2. **Given** el usuario está en el paso "Subir archivo", **When** elige descargar la plantilla en Excel, **Then** recibe un archivo `.xlsx` con las mismas columnas y fila de ejemplo.

---

### User Story 3 - Distinguir columnas obligatorias de opcionales de un vistazo (Priority: P3)

El usuario que abre la plantilla descargada puede reconocer, sin tener que volver al asistente ni leer documentación aparte, cuáles de las columnas son obligatorias para que una fila se importe y cuáles son opcionales.

**Why this priority**: Reduce errores de completado (filas que quedan "incompletas" por faltarles un dato obligatorio) pero es una mejora incremental sobre la Historia 1 — con solo tener las columnas y el ejemplo, un usuario atento ya puede completar el archivo razonablemente bien.

**Independent Test**: Puede probarse abriendo la plantilla descargada y verificando que las columnas obligatorias (nombre de zona, provincia/estado, servicio, costo transportista, precio al cliente) están marcadas de forma distinguible de las opcionales, sin necesitar el resto de la funcionalidad de importación.

**Acceptance Scenarios**:

1. **Given** el usuario abre la plantilla descargada, **When** revisa los encabezados de columna, **Then** puede identificar cuáles son obligatorias (por ejemplo, mediante una marca visual en el nombre de la columna) sin ambigüedad frente a las opcionales.

---

### Edge Cases

- Si el usuario sube la plantilla de ejemplo sin modificar los datos de la fila de muestra, el sistema la procesa como un archivo válido más — no se distingue de un archivo real, y el usuario es responsable de reemplazar los datos de ejemplo por los suyos antes de subirla.
- Si el usuario agrega columnas propias a la plantilla (fuera de las reconocidas), esas columnas se ignoran en el mapeo, igual que con cualquier otro archivo subido.
- Si el usuario borra el encabezado de una columna o cambia su texto, el sistema sigue permitiendo mapear manualmente esa columna en el paso de mapeo — la plantilla es una guía, no un requisito estructural.
- La descarga de la plantilla debe estar disponible incluso si el usuario todavía no eligió ningún archivo propio para subir (es lo primero que puede hacer al entrar al paso "Subir archivo").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer, en el paso "Subir archivo" del asistente de importación de destinos y tarifas, una opción para descargar una plantilla de ejemplo, visible y accesible antes de que el usuario elija su propio archivo.
- **FR-002**: La plantilla descargada MUST incluir todas las columnas que el asistente reconoce para destinos y tarifas (zona, provincia/estado, distrito/ciudad, corregimiento, sector o código postal, alias, servicio, costo transportista, precio al cliente, tiempo mínimo y máximo de entrega en días), usando los mismos nombres descriptivos que el usuario ya ve en el paso de mapeo de columnas.
- **FR-003**: La plantilla MUST incluir al menos una fila de ejemplo con datos de muestra plausibles que ilustren el formato esperado de cada columna, incluyendo el caso de múltiples alias en una misma celda y valores numéricos sin símbolos de moneda ni separadores de miles.
- **FR-004**: La plantilla MUST distinguir visualmente qué columnas son obligatorias (zona, provincia/estado, servicio, costo transportista, precio al cliente) de las opcionales.
- **FR-005**: El usuario MUST poder elegir descargar la plantilla en formato CSV o en formato Excel.
- **FR-006**: El archivo de plantilla descargado, si se sube sin modificaciones estructurales (incluso con la fila de ejemplo reemplazada por datos reales), MUST poder procesarse por el resto del asistente de importación sin errores atribuibles al formato de la propia plantilla.
- **FR-007**: La plantilla MUST contener únicamente datos ilustrativos de ejemplo — MUST NOT incluir destinos, zonas, tarifas ni transportistas reales del usuario o de otros usuarios del sistema.

### Key Entities

- **Plantilla de ejemplo de destinos y tarifas**: archivo descargable (CSV o Excel) que representa el formato esperado para importar destinos y tarifas de un transportista. Contiene una fila de encabezados (con las columnas reconocidas, marcando las obligatorias) y al menos una fila de datos de ejemplo ilustrativos. No está asociada a ningún transportista ni país en particular — es genérica para cualquier importación de destinos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario que nunca importó destinos antes puede, sin ayuda externa ni contactar soporte, entender el formato esperado del archivo únicamente mirando la plantilla descargada.
- **SC-002**: La proporción de archivos subidos que terminan con filas marcadas como "incompletas" por falta de un dato obligatorio se reduce frente a la situación actual (sin plantilla de referencia).
- **SC-003**: El usuario puede descargar la plantilla en menos de 2 clics desde que entra al asistente de importación de destinos.
- **SC-004**: El 100% de las columnas que el asistente de importación reconoce están representadas en la plantilla descargada, con nombres coincidentes a los que el usuario ve en el resto del asistente.

## Assumptions

- La plantilla es genérica (no depende del transportista ni del país seleccionado) — las columnas de destinos y tarifas son las mismas para cualquier importación, según lo ya definido en el asistente existente.
- "Excel" se interpreta como el formato `.xlsx`, ya que es el formato de Excel que el resto del sistema ya soporta para importar archivos.
- La plantilla se genera con una única fila de ejemplo (no un catálogo completo de casos), suficiente para ilustrar el formato sin abrumar al usuario; casos especiales (alias múltiples, campos opcionales vacíos) se cubren agregando aclaraciones o una segunda fila de ejemplo si es necesario, no un archivo extenso.
- La descarga no requiere que el usuario haya seleccionado previamente un transportista o país "reales" más allá de estar dentro del asistente de importación ya asociado a un transportista — no se solicitan datos adicionales para habilitar la descarga.
- Esta funcionalidad aplica al asistente de importación de destinos y tarifas de transportistas ya existente; no cubre otros asistentes de importación del sistema (contactos, empresas, productos, etc.), que quedan fuera de alcance.
