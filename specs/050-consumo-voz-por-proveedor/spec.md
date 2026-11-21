# Feature Specification: Consumo de voz por proveedor

**Feature Branch**: `feature/050-consumo-voz-por-proveedor`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "debemos hacer una mejora para los minutos transcritos y costo estimado por mes total esta super bien, pero tambien debe de alguna forma poder visualizarse por cada proveedor integrado (para poder tener la estimacion por proveedor, puede ser cerca de donde sale el proveedor tener la estimacion o simplemente un filtro superior que permita hacer switch por proveedor y ver costo total por proveedor), actualmente necesito saber si contamos con esta informacion para mostrarla o debemos estudiar la mejor forma de persistir esto para poder tenerlo sin que genere afectaciones."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver cuánto consumió cada proveedor este mes (Priority: P1)

El dueño del comercio tiene más de un proveedor de transcripción configurado —uno principal y uno de respaldo, o dos servicios distintos para comparar precio y calidad—. Hoy la pestaña de Voz le dice cuántos minutos transcribió y cuánto gastó **en total**, pero no cuánto le corresponde a cada servicio. Sin ese corte no puede decidir a cuál darle más prioridad, cuál apagar, ni si el de respaldo se está activando más de lo que debería.

Entra a Configuración → Voz y, en la misma fila donde ya ve cada proveedor con su alias, servicio, modelo, prioridad y tarifa por hora, ve además los minutos y el costo estimado que ese proveedor consumió en el mes en curso.

**Why this priority**: Es el pedido completo del usuario y entrega valor por sí solo. Las tarjetas de total ya existen y siguen funcionando igual; esto solo agrega el corte que falta. Sin esta historia no hay feature.

**Independent Test**: Con dos proveedores configurados y transcripciones registradas para ambos en el mes, abrir Configuración → Voz y verificar que cada fila muestra sus propios minutos y costo, y que la suma de las filas coincide con la tarjeta de total.

**Acceptance Scenarios**:

1. **Given** una cuenta con dos proveedores de voz activos y transcripciones exitosas de ambos en el mes en curso, **When** el usuario abre la pestaña de Voz, **Then** cada fila de proveedor muestra los minutos y el costo estimado de ese proveedor para el mes en curso.
2. **Given** la misma cuenta, **When** el usuario suma los minutos mostrados en todas las filas, **Then** el resultado coincide con el valor de la tarjeta "Minutos transcritos" del mes.
3. **Given** un proveedor configurado que todavía no transcribió nada en el mes en curso, **When** el usuario abre la pestaña, **Then** su fila indica explícitamente que no tuvo consumo en el mes, en vez de omitir el dato o mostrar una cifra ambigua.
4. **Given** una cuenta que recién empieza y nunca transcribió nada, **When** el usuario abre la pestaña, **Then** todas las filas indican sin consumo y las tarjetas de total siguen mostrando cero, sin errores ni espacios vacíos.
5. **Given** un proveedor desactivado que sí transcribió antes en el mes, **When** el usuario abre la pestaña, **Then** su consumo del mes sigue visible en su fila: desactivarlo no borra lo que ya se gastó.

---

### User Story 2 - Que las cifras cuadren aunque se haya borrado un proveedor (Priority: P2)

El comercio probó un servicio de transcripción durante dos semanas y después lo eliminó de la configuración. El gasto de esas dos semanas ya se facturó y sigue contando en el total del mes, pero la configuración de ese proveedor ya no existe, así que no hay fila a la cual atribuirlo.

Si ese consumo no se muestra en ninguna parte, la suma de las filas da menos que la tarjeta de total y el usuario concluye —razonablemente— que la pantalla está mal. El consumo no atribuible se muestra agrupado y rotulado como correspondiente a proveedores ya eliminados.

**Why this priority**: No bloquea el valor principal, pero sin esto el feature genera desconfianza en los números justo en la pantalla que existe para dar confianza en los números. Es el único caso en que las cifras no cuadrarían.

**Independent Test**: Registrar consumo de un proveedor, eliminar ese proveedor de la configuración, abrir la pestaña y verificar que el consumo aparece agrupado bajo un rótulo de proveedor eliminado y que la suma total sigue cuadrando.

**Acceptance Scenarios**:

1. **Given** una cuenta con consumo histórico de un proveedor que luego fue eliminado de la configuración, **When** el usuario abre la pestaña de Voz, **Then** ese consumo aparece agrupado en una entrada rotulada como proveedor eliminado.
2. **Given** ese mismo escenario, **When** el usuario suma todas las entradas visibles incluida la de proveedores eliminados, **Then** el resultado coincide exactamente con la tarjeta de total del mes.
3. **Given** una cuenta donde nunca se eliminó ningún proveedor, **When** el usuario abre la pestaña, **Then** no aparece ninguna entrada de proveedor eliminado.
4. **Given** varios proveedores distintos eliminados a lo largo del mes, **When** el usuario abre la pestaña, **Then** su consumo aparece sumado en una única entrada agrupada, sin intentar separarlos ni adivinar a cuál pertenecía cada uno.

---

### User Story 3 - Distinguir "no gastó nada" de "falta cargar la tarifa" (Priority: P3)

Un proveedor sin tarifa por hora cargada no puede producir una estimación de costo. Hoy ese hueco queda escondido: el total del mes suma solo lo de los proveedores que sí tienen tarifa y nadie nota que falta una parte.

Al desglosar por proveedor, la fila de ese proveedor debe decir explícitamente que le falta la tarifa, en vez de mostrar un costo de cero que se leería como "este servicio sale gratis".

**Why this priority**: Es una mejora de precisión sobre la historia 1, que ya entrega valor sin esto. Pero convierte un dato silenciosamente incompleto en una acción concreta para el usuario: cargar la tarifa que falta.

**Independent Test**: Configurar un proveedor sin tarifa por hora, generar consumo con él y verificar que su fila muestra los minutos reales y, en lugar de un costo, un aviso de que falta cargar la tarifa.

**Acceptance Scenarios**:

1. **Given** un proveedor sin tarifa por hora cargada con consumo en el mes, **When** el usuario abre la pestaña de Voz, **Then** su fila muestra los minutos consumidos y, en lugar de un monto, un aviso de que falta cargar la tarifa.
2. **Given** ese mismo proveedor, **When** el usuario compara el valor mostrado con cero, **Then** el aviso no es confundible con un costo de cero.
3. **Given** una cuenta donde conviven un proveedor con tarifa y otro sin tarifa, **When** el usuario mira la tarjeta de costo total del mes, **Then** el total sigue reflejando solo lo estimable, con el mismo criterio de hoy, y el desglose deja visible cuál es la parte no estimada.
4. **Given** un proveedor sin tarifa, **When** el usuario carga la tarifa por hora, **Then** las transcripciones futuras muestran costo en su fila; las anteriores a la carga conservan el costo con el que quedaron registradas.

---

### Edge Cases

- **Proveedor sin consumo en el mes**: la fila lo dice explícitamente ("sin consumo este mes"); no se oculta la fila ni se deja el espacio en blanco.
- **Proveedor eliminado**: su consumo histórico no desaparece, se agrupa bajo un rótulo propio (US2). No se intenta recuperar su alias original.
- **Proveedor sin tarifa por hora**: minutos sí, costo no, con aviso explícito (US3).
- **Intentos fallidos**: no se cuentan en el desglose, con el mismo criterio que ya aplican las tarjetas de total. Un fallo no suma minutos transcritos.
- **Transcripciones que devuelven audio inaudible**: se cuentan como consumo real, porque se procesaron y se facturaron. Mismo criterio que hoy.
- **Cambio de tarifa a mitad de mes**: cada transcripción conserva el costo calculado con la tarifa vigente en su momento; el desglose del mes es la suma de esos costos, no un recálculo con la tarifa actual.
- **Límite de mes y cambio de día**: el corte del mes es el mismo que usan las tarjetas de total hoy, definido por la zona horaria del negocio y no por la del navegador de quien mira la pantalla.
- **Muchos proveedores configurados**: la pantalla sigue legible y no requiere interacción adicional para ver cualquiera de ellos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, para cada proveedor de voz configurado en la cuenta, los minutos transcritos y el costo estimado que ese proveedor consumió en el mes en curso.
- **FR-002**: El desglose MUST aparecer junto a cada proveedor en la lista de proveedores existente, de modo que el usuario vea el consumo sin ninguna interacción adicional (sin filtros, selectores ni clics).
- **FR-003**: Las dos tarjetas de total existentes ("Minutos transcritos" y "Costo estimado del mes") MUST conservar exactamente su cálculo, su significado y su presentación actuales. El desglose se agrega; nada del total se altera.
- **FR-004**: La suma de los minutos y del costo de todas las entradas del desglose MUST coincidir con las tarjetas de total del mes, sin excepción ni redondeo que genere diferencia visible.
- **FR-005**: El consumo registrado cuyo proveedor ya no existe en la configuración MUST mostrarse agrupado en una única entrada rotulada como proveedor eliminado, para preservar FR-004.
- **FR-006**: Un proveedor sin tarifa por hora cargada MUST mostrar sus minutos y, en lugar de un monto, un aviso explícito de que falta cargar la tarifa. MUST NOT mostrar cero como si fuera el costo real.
- **FR-007**: Un proveedor configurado sin consumo en el mes en curso MUST indicarlo explícitamente en su fila.
- **FR-008**: El desglose MUST contar únicamente las transcripciones exitosas, con el mismo criterio que ya aplican las tarjetas de total.
- **FR-009**: El corte temporal del mes MUST derivarse de la zona horaria configurada del negocio, nunca de la del navegador, y MUST ser idéntico al que usan las tarjetas de total.
- **FR-010**: El desglose MUST estar acotado a la cuenta autenticada; ninguna cifra puede incluir consumo de otra cuenta.
- **FR-011**: El desglose MUST obtenerse de los registros de uso ya existentes, sin agregar campos al modelo de datos, sin migración y sin proceso de recálculo. El consumo histórico ya registrado queda desglosado de forma retroactiva al desplegar.
- **FR-012**: Ninguna credencial de proveedor —ni cifrada ni en claro— puede llegar al cliente como consecuencia de esta feature.
- **FR-013**: La pantalla MUST seguir renderizándose en el servidor, sin introducir estado de cliente ni carga diferida para mostrar el desglose.

### Key Entities

- **Registro de uso de voz**: una fila por intento de transcripción, ya existente. Guarda a qué proveedor se le pidió, el modelo que respondió, los segundos de audio, el costo estimado calculado con la tarifa vigente en ese momento, si el intento fue exitoso y cuándo ocurrió. Es la única fuente del desglose. Su vínculo con el proveedor queda vacío si el proveedor se elimina después, y ese es el origen del caso de la US2.
- **Proveedor de voz**: la configuración de un servicio de transcripción dentro de la cuenta —alias, servicio, modelo, prioridad, tarifa por hora, límite diario—. Ya se lista en pantalla; esta feature le agrega su consumo del mes.
- **Entrada del desglose**: cada línea de consumo que se muestra. Puede corresponder a un proveedor configurado o a la agrupación de proveedores eliminados. Lleva minutos, costo estimado (que puede ser no estimable) y cantidad de transcripciones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con dos o más proveedores configurados, el usuario identifica cuánto consumió cada uno en el mes sin salir de la pestaña de Voz y sin ninguna interacción adicional.
- **SC-002**: En el 100% de los casos, la suma de las entradas del desglose coincide con las tarjetas de total del mes, incluidas las cuentas que eliminaron proveedores.
- **SC-003**: Un proveedor al que le falta la tarifa por hora es identificable a simple vista; hoy ese hueco es invisible en la pantalla.
- **SC-004**: Al desplegar, el desglose cubre todo el consumo histórico ya registrado, sin ningún paso de migración, backfill ni recálculo manual.
- **SC-005**: La pestaña de Voz no tarda en cargar perceptiblemente más que antes del cambio.

## Assumptions

- **Período del desglose**: el corte por proveedor es del **mes en curso**, el mismo que la tarjeta de costo. No se agrega el corte "hoy" por proveedor: las tarjetas ya lo muestran a nivel total y repetirlo por fila satura la lista sin responder la pregunta que motivó el pedido ("cuánto me cuesta cada servicio").
- **Presentación elegida**: el usuario confirmó el desglose **en cada fila de proveedor** por sobre un filtro superior tipo switch. El motivo: permite comparar proveedores de un vistazo, no agrega estado de cliente a una pantalla que hoy es íntegramente de servidor, y reutiliza la fila que ya muestra alias, servicio, modelo, prioridad y tarifa.
- **Intentos fallidos excluidos**: se mantiene el criterio actual de las tarjetas (solo exitosas). Los intentos fallidos sí se registran y pueden costar dinero real, pero exponerlos es una decisión de producto distinta y fuera del alcance de esta feature.
- **Proveedores eliminados sin alias recuperable**: al eliminar un proveedor, el vínculo del registro histórico queda vacío a propósito, para que el gasto facturado sobreviva al borrado. No se agrega una copia del alias al registro de uso: no recuperaría los registros que ya quedaron sin vínculo y agrega estructura de datos para el mismo resultado visible.
- **El dato ya existe**: el registro de uso ya guarda a qué proveedor correspondió cada transcripción y su costo estimado ya materializado. Esta feature es un cambio de lectura y presentación; no toca el proceso de transcripción, ni la selección de proveedor, ni el registro de uso.
- **Ningún otro consumidor afectado**: el control de límite diario de minutos lee los mismos registros con su propio criterio y no se modifica.
- **Costos sin moneda explícita**: se mantiene la presentación actual del monto, sin símbolo de moneda, igual que la tarjeta de total y que la tarifa por hora en la fila del proveedor. Unificar la moneda es un tema aparte.
