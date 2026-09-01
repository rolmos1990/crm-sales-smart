# Quickstart: Validación del perfil dinámico del cliente

## Prerrequisitos

- Migración de esta spec aplicada (`PerfilClienteSnapshot`, evento `ConversacionClasificada`).
- Un contacto de prueba con: 2 pedidos entregados, 1 oportunidad abierta, 1 cotización enviada, 1 conversación clasificada `SOPORTE`.
- Un contacto de prueba sin ningún historial (recién creado).

## Escenario 1 — Perfil objetivo correcto (Historia 1)

1. Consultar `PerfilClienteService.obtenerPerfil` para el contacto con historial.
2. **Verificar**: `numeroPedidosCompletados = 2`, `oportunidadesAbiertas` incluye la oportunidad de prueba, `cotizacionesActivas` incluye la cotización enviada, `incidenciasActivas = 1`, `tipoRelacion = CLIENTE_REGULAR` (o el que corresponda según research.md Decisión 2).
3. **Verificar**: `senalesObjetivas` incluye una frase que refleja los pedidos completados y la incidencia activa, sin ningún adjetivo subjetivo.

## Escenario 2 — Contacto nuevo sin errores (Historia 1, Edge Case)

1. Consultar el perfil del contacto sin historial.
2. **Verificar**: se devuelve un perfil válido, `tipoRelacion = NUEVO_CONTACTO`, campos objetivos en cero/vacío, sin excepción.

## Escenario 3 — Separación objetivo vs. interpretado (Historia 2)

1. Con una conversación real donde el cliente mencionó un presupuesto ("tengo hasta $500 para esto"), disparar el recálculo del perfil vía el evento `ConversacionCreada` o `ConversacionResumida`.
2. **Verificar**: `datosInterpretados.presupuestoConocido` refleja el monto extraído, con `confianza` y `extraidoEn` presentes.
3. **Verificar**: `datosObjetivos` no contiene ningún campo de presupuesto — están en estructuras (`Json`) completamente separadas.
4. Simular un fallo del proveedor de IA (desactivar todos los proveedores activos de la instancia) y volver a disparar el recálculo.
5. **Verificar**: el perfil se guarda igual, con `datosObjetivos` completo y `datosInterpretados: null` (o el valor anterior conservado, según la implementación de fusión) — sin error visible al consultar el perfil.

## Escenario 4 — Actualización incremental, no por mensaje (Historia 3)

1. Consultar el perfil del contacto con historial y anotar `calculadoEn`.
2. Simular un mensaje entrante de conversación que no dispara ningún evento de la lista cerrada (por ejemplo, un mensaje sin cambio de clasificación).
3. **Verificar**: `calculadoEn` no cambia — el perfil no se recalculó.
4. Registrar un pedido nuevo como entregado para ese contacto (evento `PedidoEntregado`).
5. **Verificar**: `calculadoEn` se actualiza y `numeroPedidosCompletados` refleja el nuevo pedido, sin que haya llegado ningún mensaje de conversación.

## Escenario 5 — Aislamiento multi-tenant (FR-008)

1. Intentar consultar el perfil de un contacto pasando el `instanciaId` de otra instancia.
2. **Verificar**: se devuelve `null`, no el perfil de otro tenant.
