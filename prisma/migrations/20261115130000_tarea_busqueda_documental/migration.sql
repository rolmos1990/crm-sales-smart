-- 033-documentacion-vector-store-openai
--
-- Una busqueda en la documentacion del comercio es una llamada a IA con su
-- propio consumo de tokens, y tiene que poder distinguirse del resto en UsoIA.
--
-- Va en su propia migracion, separada de la que crea DocumentoAgenteIA: en
-- PostgreSQL un valor nuevo de enum no puede USARSE en la misma transaccion en
-- que se agrega. Hoy ninguna de las dos sentencias lo usaria, pero separarlas
-- cuesta nada y elimina la clase entera de problema.
ALTER TYPE "TareaIA" ADD VALUE 'BUSQUEDA_DOCUMENTAL';
