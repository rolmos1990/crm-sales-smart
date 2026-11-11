import type { CampoReglaCliente } from "@/sales/flujo-venta/components/constructor-condiciones";
import { OPERADORES_POR_TIPO } from "@/sales/flujo-venta/reglas/catalogo-campos";
import type { DefinicionWorkflow } from "./schema";
import { variablesDeclaradas } from "./variables";

// Campos que un nodo Condición puede evaluar. Las claves son las que el motor
// resolverá en cada ejecución (Bloque B); el editor solo las muestra.

type TipoDato = CampoReglaCliente["dataType"];

function campo(key: string, label: string, category: string, dataType: TipoDato, extra?: Partial<CampoReglaCliente>): CampoReglaCliente {
  return { key, label, category, dataType, allowedOperators: OPERADORES_POR_TIPO[dataType], ...extra };
}

export const CANALES_CONVERSACION = [
  { valor: "whatsapp_lite", etiqueta: "WhatsApp" },
  { valor: "instagram", etiqueta: "Instagram" },
  { valor: "facebook_messenger", etiqueta: "Facebook Messenger" },
  { valor: "email", etiqueta: "Email" },
];

export function camposCondicion(
  def: DefinicionWorkflow,
  etapas: { id: string; nombre: string; pipeline: string }[],
): CampoReglaCliente[] {
  return [
    campo("conversacion.clienteRespondio", "El cliente respondió (desde que empezó a esperar)", "Conversación", "BOOLEANO"),
    campo("conversacion.ultimoMensajeCliente", "Último mensaje del cliente", "Conversación", "TEXTO"),
    campo("conversacion.canal", "Canal", "Conversación", "LISTA", { allowedValues: CANALES_CONVERSACION }),
    campo("oportunidad.valor", "Valor", "Oportunidad", "MONEDA"),
    campo("oportunidad.probabilidad", "Probabilidad (%)", "Oportunidad", "NUMERO"),
    campo("oportunidad.titulo", "Título", "Oportunidad", "TEXTO"),
    campo("oportunidad.etapa", "Etapa", "Oportunidad", "LISTA", {
      allowedValues: etapas.map((e) => ({ valor: e.id, etiqueta: `${e.pipeline} · ${e.nombre}` })),
    }),
    campo("oportunidad.fechaCierre", "Fecha de cierre", "Oportunidad", "FECHA"),
    campo("contacto.email", "Email", "Contacto", "TEXTO"),
    campo("contacto.telefonoPrincipal", "Teléfono", "Contacto", "TEXTO"),
    campo("contacto.tienePedidos", "Ya tiene pedidos", "Contacto", "BOOLEANO"),
    campo("contacto.cantidadPedidos", "Cantidad de pedidos", "Contacto", "NUMERO"),
    ...variablesDeclaradas(def).map((v) => campo(v.ruta, v.etiqueta, "Variables del Workflow", "TEXTO")),
  ];
}
