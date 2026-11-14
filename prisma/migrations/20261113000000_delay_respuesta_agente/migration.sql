-- Delay en respuesta: el agente espera a que el cliente termine de escribir y
-- responde una sola vez por todo el tramo. Ver src/ai/respuesta/ventana-espera.ts.
--
-- Defaults elegidos para que ningún agente existente cambie de comportamiento
-- al desplegar: la espera nace apagada y hay que activarla por agente.

-- Respaldo por instancia, usado cuando la etapa dispara la IA sin agente
-- asignado o cuando el agente no define preferencia propia.
ALTER TABLE "Configsi investuracionIA"
  ADD COLUMN "esperarAntesDeResponder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "segundosEsperaRespuesta" INTEGER NOT NULL DEFAULT 5;

-- Nullable a propósito: NULL = heredar de ConfiguracionIA.
ALTER TABLE "AgenteIAConfig"
  ADD COLUMN "esperarAntesDeResponder" BOOLEAN DEFAULT false,
  ADD COLUMN "segundosEsperaRespuesta" INTEGER;
