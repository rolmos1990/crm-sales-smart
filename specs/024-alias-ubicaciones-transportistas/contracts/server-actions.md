# Contratos: Server Actions

Mismo patrón ya establecido en el proyecto y usado por `specs/022-transportistas-zonas-tarifas/contracts/server-actions.md`: `requirePermisoAction("transportistas", tipo)` → validar con Zod → verificar tenencia por `instanciaId` → mutar → `revalidatePath("/sales/transportistas")` → `ResultadoAccion<T>`.

## `src/sales/transportistas/zonas/alias-actions.ts` (nuevo)

- **`listarAliasUbicacion(zonaEntregaUbicacionId)`** — lectura, `"transportistas"` `ver`. Devuelve los alias de una ubicación puntual, agrupados o no por `campo`.
- **`agregarAliasUbicacion({ zonaEntregaUbicacionId, campo?, valor })`** — valida `"transportistas"` `modificar`. `campo` es opcional en el input: si no se especifica, se infiere como el nivel más específico no vacío de la ubicación (mismo criterio que `construirNombreVisible`, ver [data-model.md](../data-model.md)). Calcula `valorNormalizado` en el servidor (nunca confía en un valor normalizado enviado desde el cliente). Verifica duplicado (`instanciaId + campo + valorNormalizado`) con mensaje explícito antes de depender de `P2002` como resguardo de carrera — mismo patrón que `normalizarAlias`/`esErrorAliasDuplicado` de `src/configuracion/ia/actions.ts` (spec 021). Rechaza si `campo` corresponde a un nivel vacío de la ubicación (FR-002 / edge case del spec).
- **`eliminarAliasUbicacion(id)`** — valida `"transportistas"` `modificar` y que el alias pertenece a la instancia actual antes de borrar (FR-004).

## `src/shared/entregas/resolver-costo-envio.ts` (extendido — no es Server Action, función compartida)

- **`obtenerCandidatosEnvioPorZona(destino, opciones?: { incluirAliasYAproximado?: boolean })`** — firma existente extendida con un parámetro opcional. Con `incluirAliasYAproximado` ausente o `false` (default), comportamiento **idéntico** al actual — usado sin cambios por `calcular_costo_envio`/`validar_cobertura`/`estimar_fecha_entrega` y por la UI humana de cotización (FR-010).
- **`obtenerOpcionesEnvioConConfianza(destino)`** (nueva) — siempre con matching de alias + aproximado habilitado; devuelve `{ confianza, opciones: OpcionEnvioConConfianza[] }` según el algoritmo de [research.md §4](../research.md#4-algoritmo-de-matching-con-niveles-de-confianza). Es la función que consume la tool de IA (contracts/ai-tools.md) y, opcionalmente, cualquier UI futura de "simulador" (fuera de alcance de este spec).

## `src/sales/transportistas/importacion-destinos/actions.ts` (nuevo)

- **`revisarImportacionDestinosAction({ transportistaId, filas })`** — valida `"transportistas"` `modificar`. No persiste nada — clasifica cada fila del archivo ya parseado (client-side, vía `parsearArchivo()`) contra el catálogo existente usando `obtenerOpcionesEnvioConConfianza`/el motor de matching, devolviendo por fila: `NUEVO | COINCIDENCIA_EXACTA | POSIBLE_DUPLICADO | ALIAS_AMBIGUO`, más el/los candidato(s) encontrados cuando aplique (FR-012).
- **`confirmarImportacionDestinosAction({ transportistaId, filas, decisiones })`** — valida `"transportistas"` `modificar`. Recibe las filas ya revisadas más la decisión del usuario para cada una con estado `POSIBLE_DUPLICADO` (`"crear_nuevo" | "usar_existente:<id>"`); rechaza si queda alguna fila `ALIAS_AMBIGUO` sin excluir (FR-013). Corre en transacciones por lotes (`CHUNK = 100`, mismo patrón que `importarRegistrosAction` de `src/crm/datos/actions.ts`), creando/actualizando `ZonaEntrega`/`ZonaEntregaUbicacion`/`AliasUbicacion`/`TarifaTransportistaZona` según corresponda. Cierra registrando un `HistorialImportacion{entidad: "DESTINO_TRANSPORTISTA"}` (FR-014).

## `src/ai/tools/inicializar.ts` (extendido)

- Se agrega `import "@/ai/tools/providers/consultar-opciones-envio.tool";` junto a las demás tools de envío.

## `src/ai/tools/constantes.ts` (nuevo)

- Exporta `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES: string[]`, incluyendo `"consultar_opciones_envio"` junto a las ya existentes. Consumida por `sheet-editar-agente.tsx` (informativa) y por `obtenerHerramientasPermitidas()` en `generar-respuesta-ia.suscriptor.ts` (autorización real — FR-011, ver [research.md §6](../research.md#6-dependencia-bloqueante-herramientas-siempre-disponibles-nunca-llegan-a-runtime)).

## `scripts/backfill-normalizar-ubicaciones.ts` (nuevo — script, no Server Action)

- Exporta `calcularCamposNormalizados(ubicacion)` (función pura) y `ejecutarBackfill(prisma: PrismaLike)` — mismo esqueleto testeable que `scripts/backfill-pais-transportista.ts` (interfaz `PrismaLike` inyectable, guard `process.argv[1] === fileURLToPath(import.meta.url)`).

## Reglas transversales

- Todo mensaje de error de duplicado/negocio es fijo, nunca expone el código interno de Prisma.
- Toda consulta/mutación queda scopeada por `instanciaId` de la sesión (Principio V de la constitución).
- Ningún server action de este spec toca `editarZonaEntrega` (`src/sales/transportistas/zonas/actions.ts`) — ver auditoría de código obsoleto en [research.md §10](../research.md#10-auditoría-de-código-obsoleto-en-el-dominio-de-transportistas) para el motivo.
