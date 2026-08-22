-- Info funcional del fallo de envío (ver EnvioMensajeError) — no el stack
-- trace técnico, eso sigue solo en logs.
ALTER TABLE "MensajeConversacion" ADD COLUMN "codigoError" TEXT;
ALTER TABLE "MensajeConversacion" ADD COLUMN "motivoError" TEXT;
ALTER TABLE "MensajeConversacion" ADD COLUMN "fechaError" TIMESTAMP(3);

-- Último mensaje del CONTACTO en una conversación — la ventana de
-- mensajería de Instagram se calcula desde ahí (ver instagram-ventana.ts).
CREATE INDEX "MensajeConversacion_conversacionId_remitente_creadoEn_idx"
  ON "MensajeConversacion" ("conversacionId", "remitente", "creadoEn");
