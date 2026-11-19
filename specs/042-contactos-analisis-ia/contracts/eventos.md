# Contrato: eventos

Regla 11 de CLAUDE.md: los nombres van en pasado; hay un único contrato en
`src/eventos/contratos/`, con `version`; el nombre se registra en
`EventosSistema`; el evento se documenta en `docs/eventos.md`.

## Nuevo: `ContactoAnalizado` (`CONTACTO_ANALIZADO`, versión 1)

Se publica **después del commit** de una evaluación exitosa, una vez por
contacto. Hoy no tiene suscriptores: queda disponible para Workflows y para
SSE más adelante. El panel se actualiza consultando el estado mientras está
`PENDIENTE` o `EN_PROCESO`.

```ts
// src/eventos/contratos/contacto-analizado.event.ts
interface ContactoAnalizadoPayload {
  version: 1;
  instanciaId: string;
  contactoId: string;
  ejecucionId: string;
  origen: "REGLA" | "IA";
  puntaje: number;
  puntajeAnterior: number | null;
  intencion: "ALTA" | "MEDIA" | "BAJA" | "DESCONOCIDA" | null;
  relacionComercial: "PROSPECTO" | "CLIENTE" | "CLIENTE_RECURRENTE" | "CLIENTE_INACTIVO";
  accionSugerida: string;
  interesAplicado: boolean;   // true si el modo automático cambió nivelInteres
}
```

No lleva señales, objeciones ni motivos (texto generado), para no difundir
contenido derivado de conversaciones.

## Eventos existentes que se consumen (sin cambios en sus contratos)

| Evento | Suscriptor | Efecto nuevo |
|---|---|---|
| `PEDIDO_CREADO/ACTUALIZADO/ENTREGADO`, `COTIZACION_CREADA/ACTUALIZADA/APROBADA`, `OPORTUNIDAD_CREADA/ACTUALIZADA/GANADA/PERDIDA`, `ETAPA_CAMBIADA` | `InvalidarPerfilSuscriptor` (existente) | Recalcula la parte objetiva de 012 (sin IA, como hoy) y `marcarPendiente(P1)` |
| `CONVERSACION_CLASIFICADA` | idem | Con análisis con IA activo y disponible: sin IA en el suscriptor, `marcarPendiente(P0, inmediato)`. Si no: `recalcular` con la extracción por evento, como hoy, más `marcarPendiente(P1)` (research D3, FR-022) |
| `CONTACTO_CREADO` | `InvalidarPerfilSuscriptor`, con un routing key agregado | `marcarPendiente(P2, motivo INICIAL)` |
| `CONTACTO_ACTUALIZADO` | idem | `marcarPendiente(P1)` |

Los mensajes **no** dependen de eventos: se marcan en línea en
`interaccion.ts` (research D3).
