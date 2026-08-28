# Phase 0 Research: Acceso al login/configuración de Facebook Messenger

## R1 — ¿Por qué "Activar" no lleva al login de Meta?

**Contexto**: confirmado en `spec.md` (Diagnóstico previo) — `CardIntegracion` (`lista-integraciones.tsx`) tiene esta condición exacta:

```tsx
{instalada.estado === "ACTIVA" && integracion.clave === "whatsapp_lite" && (
  <Link href="/integraciones/whatsapp-lite">Configurar</Link>
)}
{instalada.estado === "ACTIVA" && integracion.clave === "instagram" && (
  <Link href="/integraciones/instagram">Configurar</Link>
)}
```

No existe un tercer bloque para `"facebook_messenger"`, así que activar esa integración nunca renderiza ningún enlace adicional — el usuario se queda con el botón "Desactivar" y nada más, exactamente el síntoma reportado.

**Decision**: agregar un tercer bloque idéntico en forma, apuntando a `/integraciones/facebook-messenger` (la pantalla ya construida en `005-facebook-messenger-integracion`, que ya tiene su propio botón "Conectar Facebook Messenger" hacia `/api/integraciones/facebook-messenger/oauth`).

**Rationale**: Es exactamente el mismo patrón ya usado dos veces — no hay razón de diseño para resolverlo distinto una tercera vez. Mantener la duplicación línea a línea (en vez de generalizar a un mapa `clave → href`) es intencional en este fix: generalizar el patrón es una mejora legítima pero más amplia (tocaría también los dos casos existentes) y no es lo que se pidió — se documenta como alternativa considerada, no como parte de este fix.

**Alternatives considered**:
- *Generalizar la condición a un mapa `clave → href` (`RUTA_CONFIGURACION: Record<string, string>`) y renderizar un solo bloque*: técnicamente más limpio y evita que un futuro cuarto canal repita el mismo olvido. Se descarta para **este** fix por alcance (FR-003 pide explícitamente no alterar el comportamiento ya existente de WhatsApp Lite/Instagram) — es una refactorización razonable a proponer aparte, no a mezclar con la corrección puntual pedida.
- *Que la tarjeta "Activar" del catálogo dispare directamente el login de Meta en vez de solo cambiar `estado`*: cambiaría el significado de "Activar" para las tres integraciones de mensajería y el ciclo genérico Instalar/Activar/Desactivar/Desinstalar dejaría de ser genérico. Se descarta — el patrón ya establecido (Activar = visibilidad de catálogo, Configurar = conexión real) es el que ya usan las otras dos integraciones y es el que la spec pide preservar (FR-003).

## Resumen de NEEDS CLARIFICATION resueltos

Ninguno quedó abierto — Technical Context no tenía marcadores sin resolver; la única decisión de diseño (R1) tiene una única alternativa razonable, ya tomada dos veces antes en el mismo archivo.
