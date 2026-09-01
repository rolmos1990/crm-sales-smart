import type { MensajeAnonimizado, ContenidoAnonimizado } from "./tipos";

export interface DatosContactoParaAnonimizar {
  nombre: string;
  apellido: string;
  email: string | null;
  telefonoPrincipal: string | null;
  telefonoSecundario: string | null;
}

interface MensajeOrigen {
  rol: "user" | "assistant";
  texto: string;
}

function escaparRegExp(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sustitución determinística (research.md Decisión 1) — reemplaza
 * ocurrencias literales de nombre/apellido/email/teléfonos conocidos por
 * marcadores fijos. Mejor esfuerzo sobre campos conocidos, no anonimización
 * perfecta de texto libre (Assumption de la spec).
 */
export function anonimizarContenido(
  mensajes: MensajeOrigen[],
  contacto: DatosContactoParaAnonimizar,
): ContenidoAnonimizado {
  // Orden intencional: email/teléfono primero (cadenas específicas, ej.
  // "juan.perez@example.com" contiene "juan") — si el nombre se sustituyera
  // antes, dejaría restos del email sin anonimizar (bug real detectado por
  // el test). Nombre/apellido van al final, con límites de palabra (\b)
  // para no afectar coincidencias parciales dentro de otras palabras.
  const sustitucionesExactas: Array<[string, string]> = [];
  if (contacto.email) sustitucionesExactas.push([contacto.email, "[EMAIL]"]);
  if (contacto.telefonoPrincipal) sustitucionesExactas.push([contacto.telefonoPrincipal, "[TELÉFONO]"]);
  if (contacto.telefonoSecundario) sustitucionesExactas.push([contacto.telefonoSecundario, "[TELÉFONO]"]);

  const sustitucionesConLimite: Array<[string, string]> = [];
  if (contacto.nombre.trim()) sustitucionesConLimite.push([contacto.nombre.trim(), "[NOMBRE]"]);
  if (contacto.apellido.trim()) sustitucionesConLimite.push([contacto.apellido.trim(), "[NOMBRE]"]);

  const mensajesAnonimizados: MensajeAnonimizado[] = mensajes.map((m) => {
    let texto = m.texto;
    for (const [valor, marcador] of sustitucionesExactas) {
      texto = texto.replace(new RegExp(escaparRegExp(valor), "gi"), marcador);
    }
    for (const [valor, marcador] of sustitucionesConLimite) {
      texto = texto.replace(new RegExp(`\\b${escaparRegExp(valor)}\\b`, "gi"), marcador);
    }
    return { rol: m.rol, texto };
  });

  return { mensajes: mensajesAnonimizados };
}
