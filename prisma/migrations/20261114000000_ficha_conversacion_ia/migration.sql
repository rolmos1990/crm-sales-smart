-- 031-memoria-y-ficha-conversacion — ficha de UNA conversación en curso: qué
-- producto se habló, qué precio ya se le informó al cliente, qué quedó
-- preguntado. La escribe el nodo "Atención IA" después de cada respuesta.
--
-- Aditiva y sin backfill: la ausencia de fila es un estado válido y significa
-- "esta conversación todavía no tiene ficha". Ningún agente ni Workflow
-- existente cambia de comportamiento al desplegar esto — la ficha solo se
-- escribe cuando el nodo la tiene activada, y arranca desactivada.
--
-- Distinta de "PerfilClienteSnapshot", que es por contacto y de largo plazo.

CREATE TABLE "FichaConversacionIA" (
    "id" TEXT NOT NULL,
    -- Derivado de datos verificables: resultados de herramientas y mensajes
    -- efectivamente enviados. Nunca de lo que el modelo cree recordar.
    "hechos" JSONB NOT NULL,
    -- Derivado por IA: puede equivocarse, y se le presenta al agente
    -- etiquetado como no confirmado. NULL hasta la primera derivación.
    "interpretado" JSONB,
    "turnos" INTEGER NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversacionId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "FichaConversacionIA_pkey" PRIMARY KEY ("id")
);

-- 1-1 con la conversación.
CREATE UNIQUE INDEX "FichaConversacionIA_conversacionId_key" ON "FichaConversacionIA"("conversacionId");

-- Toda lectura va acotada al tenant sin necesidad de join.
CREATE INDEX "FichaConversacionIA_instanciaId_idx" ON "FichaConversacionIA"("instanciaId");

ALTER TABLE "FichaConversacionIA"
  ADD CONSTRAINT "FichaConversacionIA_conversacionId_fkey"
  FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FichaConversacionIA"
  ADD CONSTRAINT "FichaConversacionIA_instanciaId_fkey"
  FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
