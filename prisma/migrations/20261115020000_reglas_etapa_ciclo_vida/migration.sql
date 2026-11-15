-- Reglas de ciclo de vida del agente: texto libre que describe a qué etapa
-- del pipeline mover la oportunidad y bajo qué condición. Lo ejecuta la
-- herramienta `actualizar_etapa_oportunidad`.
--
-- Aditiva y nullable: ningún agente existente cambia de comportamiento, y el
-- bloque solo llega al prompt si además la herramienta está habilitada (que
-- por defecto no lo está).
ALTER TABLE "AgenteIAConfig" ADD COLUMN "reglasEtapaCicloVida" TEXT;
