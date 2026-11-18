# Contrato: Eventos de dominio (041)

Nombres en pasado, registrados en `EventosSistema` (`src/eventos/catalogo.ts`), contrato único en `src/eventos/contratos/`, `version: 1` en el envelope (`EventoDominio.version`), documentados en `docs/eventos.md` (sección Contactos). Se publican con `publicadorEventos.publicar(...)` **después** del commit de la transacción que hizo el cambio. Sin suscriptores en esta spec.

## ContactoInteresActualizado

- **Catálogo**: `ContactoInteresActualizado: "CONTACTO_INTERES_ACTUALIZADO"`
- **Contrato**: `src/eventos/contratos/contacto-interes-actualizado.event.ts`
- **Publicado por**: `src/crm/contactos/clasificacion.ts` (servicio llamado por `actualizarInteresContactoAction`; en 042 también por el análisis de IA)

```ts
export interface ContactoInteresActualizadoPayload {
  instanciaId: string;
  contactoId: string;
  nivelAnterior: "ALTO" | "MEDIO" | "BAJO" | "SIN_EVALUAR";
  nivelNuevo: "ALTO" | "MEDIO" | "BAJO" | "SIN_EVALUAR";
  fijado: boolean;
  origen: "MANUAL" | "REGLA" | "IA";
  usuarioInstanciaId: string | null;
}
```

## ContactoPreferenciaContactoActualizada

- **Catálogo**: `ContactoPreferenciaContactoActualizada: "CONTACTO_PREFERENCIA_CONTACTO_ACTUALIZADA"`
- **Contrato**: `src/eventos/contratos/contacto-preferencia-contacto-actualizada.event.ts`
- **Publicado por**: `src/crm/contactos/clasificacion.ts`

```ts
export interface ContactoPreferenciaContactoActualizadaPayload {
  instanciaId: string;
  contactoId: string;
  noContactar: boolean;          // estado nuevo
  origen: "MANUAL" | "IA";
  usuarioInstanciaId: string | null;
}
```

## No se publican eventos

- Por actualizar `ultimaInteraccionEn` / `esperandoRespuestaDesde`: son efectos de eventos que ya existen (`MensajeRecibido`, `MensajeEnviado`, `ActividadCreada`, `PedidoCreado`).
- Por la siembra inicial (script de datos): no es un cambio de negocio en tiempo real; queda trazada en el historial.
