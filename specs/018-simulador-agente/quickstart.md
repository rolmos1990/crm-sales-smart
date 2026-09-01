# Quickstart: Validación del simulador de agente

## Prerrequisitos

- Specs `009`–`017` implementadas.
- Un agente con estrategias asignadas (`011`), tools operativas habilitadas (`015`), automatización configurada (`016`), y un borrador pendiente de publicar (`009`).

## Escenario 1 — Simulación completa con diagnóstico (Historia 1)

1. Abrir el simulador, elegir el agente de prueba.
2. Definir cliente simulado: tipo de relación `CLIENTE_REGULAR`, intención `LISTO_PARA_COMPRAR`.
3. Escribir un mensaje que active una tool de solo lectura (ej. "¿tienen stock de X?") y otra que active una acción comercial (ej. "hazme una cotización de X").
4. **Verificar**: se muestra la respuesta generada junto con perfil simulado usado, estrategia seleccionada, ejemplos recuperados, herramientas ejecutadas (marcando cuáles fueron previsualizadas), reglas aplicadas, y nivel de confianza.
5. **Verificar**: ninguna `Cotizacion` real se creó en el sistema — revisar la lista real de Cotizaciones y confirmar que no aparece ninguna nueva.

## Escenario 2 — Información faltante señalada (Historia 1, escenario 4)

1. Sin ningún `MetodoEntregaConfig` configurado, simular un mensaje que pregunte por costo de envío.
2. **Verificar**: el diagnóstico señala explícitamente la ausencia de configuración de métodos de entrega como información faltante.

## Escenario 3 — Comparar tipos de cliente (Historia 2)

1. Simular el mismo mensaje con `CLIENTE_NUEVO` y luego con `CLIENTE_INACTIVO`.
2. **Verificar**: si hay estrategias distintas asignadas a esos tipos de relación, el diagnóstico refleja la diferencia (estrategia seleccionada distinta).

## Escenario 4 — Comparar versión publicada vs. borrador (Historia 3)

1. Con un borrador pendiente que cambia una regla del agente, ejecutar la simulación en modo comparar para el mismo mensaje.
2. **Verificar**: se muestran dos respuestas/diagnósticos lado a lado, identificados como "versión publicada" y "borrador", reflejando la diferencia esperada.

## Escenario 5 — Cero efectos reales, incluida autonomía (Edge Case)

1. Simular un mensaje que activaría el nivel `HUMAN_ONLY` de `016` (ej. un reclamo).
2. **Verificar**: el diagnóstico muestra la decisión de autonomía (`NO_GENERAR` o `PENDIENTE` según corresponda), pero no se crea ninguna fila real en `RespuestaPendienteRevision` de producción ni se envía nada.

## Escenario 6 — Navegación consolidada (Historia 4)

1. Abrir la configuración de un agente.
2. **Verificar**: las 10 secciones (Identidad, Comunicación, Reglas, Estrategias, Conocimiento, Conversaciones piloto, Datos y herramientas, Automatización, Simulador, Versiones) son accesibles desde una única navegación, cada una mostrando el contenido ya construido por su spec correspondiente.
