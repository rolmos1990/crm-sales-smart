-- Zona horaria IANA de preferencia del usuario — SOLO presentación.
--
-- Nullable y sin default a propósito: null significa "heredar la zona de la
-- empresa", que es el comportamiento actual, así que esta migración no cambia
-- nada de lo que ya se ve. No lleva backfill.
--
-- Esta columna NUNCA debe usarse para calcular rangos de día, filtros, KPIs ni
-- cuotas: eso siempre sale de ConfiguracionEmpresa.zonaHoraria. Ver
-- src/shared/fechas/negocio.ts vs src/shared/fechas/presentacion.ts.
ALTER TABLE "Usuario" ADD COLUMN "zonaHoraria" TEXT;
