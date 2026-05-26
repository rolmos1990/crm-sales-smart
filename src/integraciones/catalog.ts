import type { IntegracionCatalogo } from "./types";

export const CATALOGO_INTEGRACIONES: IntegracionCatalogo[] = [
  // ── Mensajería ─────────────────────────────────────────────────
  {
    clave:       "whatsapp_business",
    nombre:      "WhatsApp Business",
    descripcion: "Envía mensajes, automatiza respuestas y gestiona conversaciones con clientes directamente desde el CRM usando la API oficial de WhatsApp Business.",
    categoria:   "mensajeria",
    logoEmoji:   "💬",
    disponible:  true,
    badges:      ["Oficial"],
  },
  {
    clave:       "whatsapp_lite",
    nombre:      "WhatsApp Lite",
    descripcion: "Conecta tu número de WhatsApp sin API oficial. Ideal para equipos pequeños que quieren integrar WhatsApp de forma rápida mediante QR.",
    categoria:   "mensajeria",
    logoEmoji:   "💬",
    disponible:  true,
  },

  // ── Marketing ──────────────────────────────────────────────────
  {
    clave:       "mailchimp",
    nombre:      "Mailchimp",
    descripcion: "Sincroniza contactos y oportunidades con tus audiencias de Mailchimp. Crea campañas de email marketing segmentadas desde el CRM.",
    categoria:   "marketing",
    logoEmoji:   "🐒",
    disponible:  true,
  },
  {
    clave:       "sendinblue",
    nombre:      "Brevo (Sendinblue)",
    descripcion: "Integra tus contactos con Brevo para enviar emails transaccionales y campañas de marketing automatizadas.",
    categoria:   "marketing",
    logoEmoji:   "📧",
    disponible:  false,
    proximamente: true,
  },

  // ── Pagos ──────────────────────────────────────────────────────
  {
    clave:       "mercadopago",
    nombre:      "Mercado Pago",
    descripcion: "Genera links de pago y recibe notificaciones de cobro directamente en las oportunidades y pedidos del CRM.",
    categoria:   "pagos",
    logoEmoji:   "💳",
    disponible:  false,
    proximamente: true,
  },
  {
    clave:       "stripe",
    nombre:      "Stripe",
    descripcion: "Gestiona cobros, suscripciones y facturas integrando Stripe con tus oportunidades y cotizaciones.",
    categoria:   "pagos",
    logoEmoji:   "⚡",
    disponible:  false,
    proximamente: true,
  },

  // ── Productividad ──────────────────────────────────────────────
  {
    clave:       "google_calendar",
    nombre:      "Google Calendar",
    descripcion: "Sincroniza las actividades y reuniones del CRM con Google Calendar. Crea eventos automáticamente al registrar actividades.",
    categoria:   "productividad",
    logoEmoji:   "📅",
    disponible:  false,
    proximamente: true,
  },
  {
    clave:       "slack",
    nombre:      "Slack",
    descripcion: "Recibe notificaciones en Slack cuando se mueven oportunidades, se cierran tratos o se crean actividades importantes.",
    categoria:   "productividad",
    logoEmoji:   "🔔",
    disponible:  false,
    proximamente: true,
  },

  // ── Analytics ─────────────────────────────────────────────────
  {
    clave:       "google_analytics",
    nombre:      "Google Analytics",
    descripcion: "Conecta eventos del CRM con Google Analytics 4 para medir el impacto de tus acciones comerciales en el tráfico web.",
    categoria:   "analytics",
    logoEmoji:   "📊",
    disponible:  false,
    proximamente: true,
  },
];

export const CATEGORIAS: { valor: string; etiqueta: string }[] = [
  { valor: "todas",         etiqueta: "Todas" },
  { valor: "mensajeria",    etiqueta: "Mensajería" },
  { valor: "marketing",     etiqueta: "Marketing" },
  { valor: "pagos",         etiqueta: "Pagos" },
  { valor: "productividad", etiqueta: "Productividad" },
  { valor: "analytics",     etiqueta: "Analytics" },
];
