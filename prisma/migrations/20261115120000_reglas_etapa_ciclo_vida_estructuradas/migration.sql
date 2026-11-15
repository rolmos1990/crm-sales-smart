-- Las reglas de ciclo de vida pasan de un texto libre a una lista
-- estructurada: cada regla es {id, etapa, cuandoAplica}, con la etapa elegida
-- de un desplegable con las etapas reales del pipeline. Escribir el nombre a
-- mano era la parte fragil: un nombre que no existe hace que la herramienta
-- no mueva nada, y recien se descubre en una conversacion real.
--
-- DROP y no una conversion: la columna TEXT se agrego en
-- 20261115020000_reglas_etapa_ciclo_vida, del dia anterior, y se verifico
-- contra la base que ningun AgenteIAConfig tiene un valor cargado. No hay
-- nada que convertir, y el texto libre no tenia una forma parseable a la que
-- mapear la etapa de destino.
ALTER TABLE "AgenteIAConfig" DROP COLUMN "reglasEtapaCicloVida";
ALTER TABLE "AgenteIAConfig" ADD COLUMN "reglasEtapaCicloVida" JSONB;
