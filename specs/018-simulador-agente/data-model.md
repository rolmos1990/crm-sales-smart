# Data Model: Simulador de agente y experiencia de configuración consolidada

## `ContextoTool` (extendido, `src/ai/tools/types.ts`)

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `modoSimulacion` | `boolean?` | `undefined`/`false` = comportamiento actual exacto (ninguna tool cambia su lógica); `true` = las tools que escriben devuelven previsualización sin persistir (research.md Decisión 1). |

## `EscenarioSimulacion` (tipo de aplicación, no Prisma)

```ts
interface ClienteSimulado {
  tipoRelacion: TipoRelacionCliente; // catálogo de 011
  intencion: IntencionComercial;      // catálogo de 011
}

interface EscenarioSimulacion {
  agenteIAConfigId: string;
  instanciaId: string;
  cliente: ClienteSimulado;
  usarBorrador: boolean; // research.md Decisión 4
  mensajes: string[]; // conversación de prueba, en orden
}
```

## `DiagnosticoRespuestaSimulada` (tipo de aplicación)

```ts
interface DiagnosticoRespuestaSimulada {
  respuesta: string;
  perfilClienteUsado: ClienteSimulado;
  estrategiaSeleccionada: { id: string; nombre: string; motivo: string } | null; // de 011
  ejemplosRecuperados: Array<{ id: string; etiquetasCoincidentes: number }>;      // de 014
  herramientasEjecutadas: Array<{ nombre: string; resultado: unknown; previsualizado: boolean }>; // 015, previsualizado=true si escribía datos
  informacionOperativaConsultada: string[]; // nombres de tools de solo lectura ejecutadas
  reglasAplicadas: string[]; // resumen de reglas obligatorias/estructuradas activas (009)
  nivelConfianza: number | null; // de la clasificación de 016, si se ejecutó
  informacionFaltante: string[]; // ej. "Sin métodos de entrega configurados" — señales explícitas de "no sé"
  decisionAutonomia: { accion: "ENVIAR" | "PENDIENTE" | "NO_GENERAR"; motivo: string } | null; // de 016
}
```

## `SimulacionEjecutada` (opcional, ver research.md Decisión 3 — no obligatoria para cumplir la spec)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `agenteIAConfigId` | `String` | |
| `escenario` | `Json` | `EscenarioSimulacion` serializado. |
| `resultado` | `Json` | `DiagnosticoRespuestaSimulada[]` (uno por mensaje de la conversación de prueba). |
| `creadoPorUsuarioId` | `String?` | |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@index([instanciaId])`. Explícitamente **no** referenciada por `UsoIA`, `RespuestaPendienteRevision` ni `EvaluacionRespuestaIA` — aislada de la auditoría de producción por diseño.

## Relación

```text
EscenarioSimulacion ──> SimuladorService.ejecutar(...)
                              │  (reutiliza, con datos simulados donde corresponde)
                              ├──> resolverProveedorPorObjetivo (010)
                              ├──> seleccionarEstrategia (011)
                              ├──> [perfil simulado, no PerfilClienteService] (012 — reemplazado, no llamado)
                              ├──> construirContextoCompuesto (013)
                              ├──> recuperador-ejemplos (014)
                              ├──> tools con ctx.modoSimulacion=true (015)
                              ├──> decidirAutonomia (016, sin persistir RespuestaPendienteRevision real)
                              └──> DiagnosticoRespuestaSimulada (nunca persiste en 017)
```

Ninguna tabla de producción existente se modifica. `ContextoTool.modoSimulacion` es la única extensión de un tipo ya existente, y es opcional por diseño (default `false`/`undefined` = comportamiento actual de cada tool sin ningún cambio).
