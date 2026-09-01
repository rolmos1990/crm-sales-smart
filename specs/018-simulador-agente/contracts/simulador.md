# Contratos: `src/ai/simulador/`

## `SimuladorService.ejecutar(escenario)`

```ts
async function ejecutar(escenario: EscenarioSimulacion): Promise<DiagnosticoRespuestaSimulada[]>
```

- **Comportamiento**: por cada mensaje de `escenario.mensajes`, en orden (manteniendo el historial simulado de la conversación entre mensajes dentro de la misma sesión):
  1. Resuelve la configuración del agente — vigente publicada o borrador según `escenario.usarBorrador` (research.md Decisión 4).
  2. Arma `InsumosContexto` con `perfilCliente` construido directamente desde `escenario.cliente` (research.md Decisión 2) — sin llamar a `PerfilClienteService`.
  3. Llama a `construirContextoCompuesto` (`013`) con esos insumos.
  4. Llama al gateway de IA (`010`-enrutado) con `ctx.modoSimulacion: true` propagado a cualquier tool que se ejecute.
  5. Ensambla el `DiagnosticoRespuestaSimulada` a partir de los resultados intermedios ya disponibles (estrategia seleccionada, ejemplos recuperados, tools ejecutadas, decisión de autonomía) — sin llamar a `ensamblarYPersistirRegistro` de `017` (no se persiste como registro de producción).
- **Sin efectos secundarios reales**: ninguna llamada dentro de este flujo escribe en `Cotizacion`, `Pedido`, `Oportunidad`, `Conversacion.clasificacion`, ni envía un mensaje real — garantizado transitivamente por el chequeo de `modoSimulacion` en cada tool (contrato siguiente).

## Contrato de `modoSimulacion` en cada tool que escribe (`crear_cotizacion`, `crear_pedido`, `agregar_productos_oportunidad`, `transferir_a_humano`, `actualizar_info_contacto`, `agregar_etiqueta_contacto`)

```ts
async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
  const parsed = ArgsSchema.safeParse(args);
  if (!parsed.success) return { ok: false, error: "..." };

  if (ctx.modoSimulacion) {
    const calculado = /* la misma lógica de cálculo/validación ya existente, sin tocar Prisma */;
    return { ok: true, data: { ...calculado, previsualizado: true } };
  }

  // comportamiento real existente, sin cambios
}
```

- **Garantía verificable**: cada tool de esta lista tiene un test que confirma `prisma.<modelo>.create/update/delete` no se invoca cuando `ctx.modoSimulacion === true` (mock de Prisma con espía, o verificación de que el conteo de filas no cambia).

## `src/app/configuracion/ia/` — navegación consolidada (Historia 4)

No es una Server Action — es la reestructuración del layout de la tab "Inteligencia Artificial" en 10 sub-rutas o tabs internos, cada uno renderizando el componente ya construido por su spec de origen:

| Sección | Componente ya existente (spec de origen) |
|---|---|
| Identidad | `seccion-identidad.tsx` (`009`) |
| Comunicación | `seccion-comunicacion.tsx` (`009`) |
| Reglas | `seccion-reglas.tsx` (`009`) |
| Estrategias | `lista-estrategias.tsx` + `asignar-estrategias-agente.tsx` (`011`) |
| Conocimiento | NUEVO — vista de solo lectura combinando instrucciones adicionales (`009`) + resumen de tools/datos operativos disponibles (`015`) |
| Conversaciones piloto | `seleccionar-conversacion-piloto.tsx` + `bandeja-recomendaciones.tsx` (`014`) |
| Datos y herramientas | `seccion-metodos-entrega.tsx` (`015`) + lista de herramientas habilitadas (ya existente antes de `015`) |
| Automatización | `seccion-automatizacion.tsx` (`016`) |
| Simulador | `panel-simulador.tsx` + `comparador-versiones.tsx` (esta spec) |
| Versiones | `seccion-versiones.tsx` (`009`) |

Esta spec no reescribe ninguno de los componentes listados — solo los organiza bajo una navegación común y construye "Conocimiento" y "Simulador" (las dos únicas celdas de la tabla sin componente previo).
