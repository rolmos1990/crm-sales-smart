import { z } from "zod";
import { OperadorCondicion } from "@/generated/prisma/enums";

export const EtapaSchema = z.object({
  nombre:              z.string().min(1, "El nombre es requerido").max(80),
  descripcion:         z.string().max(300).optional().or(z.literal("")),
  color:               z.string().optional().or(z.literal("")),
  orden:               z.number().int().min(0),
  esInicial:           z.boolean().optional(),
  esFinal:             z.boolean().optional(),
  esCancelacion:       z.boolean().optional(),
  esSecuencial:         z.boolean().optional(),
  permiteEditarPedido:  z.boolean().optional(),
  permiteEditarEntrega: z.boolean().optional(),
  activo:               z.boolean().optional(),
  parentId:            z.string().nullable().optional(),
});

// Operador válido: cualquier valor real del enum de Prisma (se extendió para
// cubrir texto/número/moneda/lista/fecha/booleano/colección/archivo — ver
// ./reglas/tipos.ts). Al ser JSON libre (`arbolCondiciones`), esto es lo que
// impide que se guarde basura ahí adentro.
const OperadorSchema = z.enum(Object.values(OperadorCondicion) as [string, ...string[]]);

export const NodoCondicionSchema = z.object({
  type: z.literal("condition"),
  fieldKey: z.string().min(1),
  operator: OperadorSchema,
  value: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  comparisonFieldKey: z.string().nullable().optional(),
});

// Anidamiento limitado a 2 niveles: el grupo raíz puede contener condiciones
// o grupos, pero esos grupos hijos ya no pueden contener más grupos.
export const NodoGrupoNivel2Schema = z.object({
  type: z.literal("group"),
  logicalOperator: z.enum(["AND", "OR"]),
  children: z.array(NodoCondicionSchema).min(1).max(50),
});

export const ArbolCondicionesSchema = z.object({
  type: z.literal("group"),
  logicalOperator: z.enum(["AND", "OR"]),
  children: z.array(z.union([NodoCondicionSchema, NodoGrupoNivel2Schema])).min(1, "Agrega al menos una condición").max(50),
});

// Legado — la tabla FlujoVentaReglaCondicion plana (AND). Se sigue aceptando
// en el schema únicamente para no romper la deserialización de reglas viejas
// dentro del propio formulario; crear/editar desde acá siempre guarda en
// `arbolCondiciones` (ver actions.ts).
export const CondicionSchema = z.object({
  campo:    z.string().min(1),
  operador: OperadorSchema,
  valor:    z.string(),
});

export const ReglaSchema = z.object({
  nombre:            z.string().min(1, "El nombre es requerido").max(120),
  descripcion:       z.string().max(500).optional().or(z.literal("")),
  activo:            z.boolean().optional(),
  estado:            z.enum(["BORRADOR", "PUBLICADA"]).optional(),
  prioridad:         z.number().int().min(0),
  etapaDestinoId:    z.string().min(1, "Selecciona una etapa destino"),
  arbolCondiciones:  ArbolCondicionesSchema,
  mensajeFallo:      z.string().max(200).optional().or(z.literal("")),
  mostrarPendientes: z.boolean().optional(),
});

export const FlujoVentaSchema = z.object({
  nombre:      z.string().min(1, "El nombre es requerido").max(120),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  esDefault:   z.boolean().optional(),
});

export type EtapaInput = z.infer<typeof EtapaSchema>;
export type ReglaInput = z.infer<typeof ReglaSchema>;
export type FlujoVentaInput = z.infer<typeof FlujoVentaSchema>;
