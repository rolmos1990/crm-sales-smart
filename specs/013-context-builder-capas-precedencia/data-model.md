# Data Model: Construcción del contexto de IA por capas con precedencia

Esta spec no agrega tablas Prisma — es composición en memoria sobre datos ya modelados por `009`, `011` y `012`. Los siguientes son tipos de aplicación (`src/ai/contexto/context-builder.ts`), no entidades persistidas.

## `CapaContexto`

```ts
interface InsumosContexto {
  instanciaId: string;
  agenteIAConfigId?: string;
  conversacionId?: string;
  contactoId?: string;
  oportunidadId?: string;
  // resultados intermedios que capas posteriores pueden necesitar,
  // poblados a medida que capas anteriores se ejecutan:
  perfilCliente?: PerfilCliente | null; // poblado por la capa 5, leído por la 4 antes de ejecutarse (ver research.md Decisión 2)
}

interface CapaContexto {
  nombre: string;         // uno de los 11 nombres de la spec, para trazabilidad/debug
  precedencia: number;    // 1 (mayor peso) a 11 (menor peso) — orden fijo, no configurable
  producir: (insumos: InsumosContexto) => Promise<string | null>; // null = capa omitida (FR-003)
}
```

## `ContextoCompuesto` (resultado)

```ts
interface ContextoCompuesto {
  systemPrompt: string;              // resultado de concatenar las capas 1-3 y 7-11 con contenido, en orden
  mensajesConversacion: MensajeContexto[]; // capa 6, ya con el shape existente de tipos.ts
  estrategiaSeleccionada: { id: string; nombre: string } | null; // metadata de la capa 4, para auditoría/UI
  perfilClienteUsado: boolean;        // metadata de la capa 5, para debug/simulador (018)
}
```

`construirSystemPrompt` (firma pública existente de `009`) pasa a ser internamente un caso particular: se invoca `construirContextoCompuesto` con `perfilCliente`/`conversacionId` ausentes y se toma solo `systemPrompt` del resultado — sin cambiar lo que sus consumidores actuales reciben.

## Relación con entidades existentes (solo lectura)

```text
AgenteIAConfig (009, versión publicada vigente) ──> capas 2, 3, 10
PlaybookEstrategia + AgentePlaybookAsignacion (011) ──> capa 4 (vía seleccionarEstrategia)
PerfilClienteSnapshot (012) ──> capa 5 (vía PerfilClienteService.obtenerPerfil)
Conversacion + Mensaje (existente) ──> capa 6
```
