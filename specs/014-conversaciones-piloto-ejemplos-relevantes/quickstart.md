# Quickstart: Validación de conversaciones piloto y ejemplos relevantes

## Prerrequisitos

- Migraciones de esta spec aplicadas.
- Al menos 3 conversaciones reales con contenido variado (una con reclamo, una de venta exitosa, una ambigua).
- Spec `013` implementada (capa 9 lista para conectar).

## Escenario 1 — Seleccionar, anonimizar, etiquetar (Historia 1)

1. Elegir una conversación de venta exitosa → crear `ConversacionPiloto` como `POSITIVO`, con explicación.
2. Etiquetar con intención `LISTO_PARA_COMPRAR` y tipo de cliente `CLIENTE_NUEVO`.
3. Intentar incluirla en el perfil sin anonimizar → **verificar**: rechazado con el mensaje esperado.
4. Anonimizar → **verificar**: el `contenidoAnonimizado` ya no contiene el nombre/email/teléfono del contacto.
5. Incluirla en el perfil → **verificar**: éxito.

## Escenario 2 — Análisis y bandeja de aprobación (Historia 2)

1. Repetir el Escenario 1 con 2 conversaciones piloto más (una negativa con explicación).
2. Ejecutar `ejecutarAnalisisPiloto`.
3. **Verificar**: se generan una o más `RecomendacionComportamiento` con `estado: PENDIENTE`.
4. Aprobar una → **verificar**: cambia a `APROBADA`; la configuración publicada del agente (`AgenteIAConfig`) no cambió.
5. Convertir otra en ejemplo → **verificar**: se crea un `EjemploPrompt`, `estado` pasa a `CONVERTIDA_EJEMPLO`.
6. Rechazar una tercera → **verificar**: `estado: RECHAZADA`.
7. Ejecutar el análisis de nuevo → **verificar**: no se repite una recomendación equivalente a la rechazada.

## Escenario 3 — Recuperación acotada y relevante (Historia 3)

1. Con 6+ `EjemploPrompt` activos con etiquetas variadas, llamar a `recuperador-ejemplos.recuperar` con `{ intencion: "LISTO_PARA_COMPRAR", tipoCliente: "CLIENTE_NUEVO" }`.
2. **Verificar**: devuelve entre 2 y 4 ejemplos, los más coincidentes primero.
3. Llamar con criterios que no coinciden con ningún ejemplo.
4. **Verificar**: devuelve una lista vacía, no ejemplos irrelevantes.
5. Generar una respuesta real para un agente sin ejemplos disponibles.
6. **Verificar**: la generación continúa normalmente, sin la capa 9 del prompt.

## Escenario 4 — Aislamiento multi-tenant (FR-012, Edge Case "intento de recuperar ejemplos de otro tenant")

1. Con ejemplos aprobados en la instancia A, llamar a `recuperar` con `instanciaId` de la instancia B.
2. **Verificar**: no se devuelve ningún ejemplo de la instancia A.

## Escenario 5 — Convertir en regla usa el flujo de `009`

1. Aprobar una recomendación y elegir "Convertir en regla".
2. **Verificar**: se navega a la sección Reglas de `009` con el texto de `reglaSugerida` pre-cargado en el borrador, sin haber escrito nada todavía en la versión publicada.
3. Publicar el borrador desde ahí (flujo ya existente de `009`).
4. **Verificar**: recién ahí la recomendación queda `CONVERTIDA_REGLA`.
