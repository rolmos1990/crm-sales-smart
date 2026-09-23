-- 028-respuestas-guia-catalogo-ia — aditiva: una columna nullable y dos con
-- default. Los agentes existentes quedan con el catálogo activado (límite 30)
-- y sin respuestas guía.
ALTER TABLE "AgenteIAConfig" ADD COLUMN "respuestasGuia" JSONB;
ALTER TABLE "AgenteIAConfig" ADD COLUMN "catalogoEnContexto" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AgenteIAConfig" ADD COLUMN "limiteCatalogoContexto" INTEGER NOT NULL DEFAULT 30;
