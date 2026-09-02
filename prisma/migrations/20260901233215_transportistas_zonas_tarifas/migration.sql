-- 022-transportistas-zonas-tarifas
-- Orden estricto (research.md Decisión 1, Restricciones técnicas de plan.md):
--   1) crear las tablas nuevas y las columnas nuevas en tablas existentes
--   2) backfill de TransportistaCoberturaGeografica -> ZonaEntrega/ZonaEntregaUbicacion/ServicioTransportista/TarifaTransportistaZona
--   3) recién al final, retirar TransportistaCoberturaGeografica

-- CreateEnum
CREATE TYPE "TipoEntidadHistorialTransportista" AS ENUM ('TRANSPORTISTA', 'TARIFA', 'CONDICIONES', 'ZONA_MANUAL', 'COSTO_MANUAL');

-- AlterTable
ALTER TABLE "ConfiguracionEmpresa" ADD COLUMN     "permiteConvertirSinConfirmarCostoEnvio" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EntregaCotizacion" ADD COLUMN     "corregimiento" TEXT,
ADD COLUMN     "costoEnvioConfirmado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "costoInternoEnvio" DECIMAL(65,30),
ADD COLUMN     "costoManualAutorizadoPorId" TEXT,
ADD COLUMN     "sectorOCodigoPostal" TEXT,
ADD COLUMN     "servicioTransportistaId" TEXT,
ADD COLUMN     "tarifaTransportistaZonaId" TEXT,
ADD COLUMN     "zonaAsignadaManualmente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zonaEntregaId" TEXT;

-- AlterTable
ALTER TABLE "EntregaPedido" ADD COLUMN     "corregimiento" TEXT,
ADD COLUMN     "costoEnvioConfirmado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "costoInternoEnvio" DECIMAL(65,30),
ADD COLUMN     "costoManualAutorizadoPorId" TEXT,
ADD COLUMN     "sectorOCodigoPostal" TEXT,
ADD COLUMN     "servicioTransportistaId" TEXT,
ADD COLUMN     "tarifaTransportistaZonaId" TEXT,
ADD COLUMN     "zonaAsignadaManualmente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zonaEntregaId" TEXT;

-- AlterTable
ALTER TABLE "Transportista" ADD COLUMN     "correoElectronico" TEXT,
ADD COLUMN     "notasInternas" TEXT,
ADD COLUMN     "personaContacto" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateTable
CREATE TABLE "ZonaEntrega" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ZonaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonaEntregaUbicacion" (
    "id" TEXT NOT NULL,
    "zonaEntregaId" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "provinciaEstado" TEXT,
    "distritoCiudad" TEXT,
    "corregimiento" TEXT,
    "sectorOCodigoPostal" TEXT,

    CONSTRAINT "ZonaEntregaUbicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioTransportista" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "transportistaId" TEXT NOT NULL,

    CONSTRAINT "ServicioTransportista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaTransportistaZona" (
    "id" TEXT NOT NULL,
    "costoInterno" DECIMAL(65,30) NOT NULL,
    "precioCliente" DECIMAL(65,30) NOT NULL,
    "tiempoMinimoDias" INTEGER,
    "tiempoMaximoDias" INTEGER,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "zonaEntregaId" TEXT NOT NULL,
    "servicioTransportistaId" TEXT NOT NULL,

    CONSTRAINT "TarifaTransportistaZona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CondicionesTransportista" (
    "id" TEXT NOT NULL,
    "diasEntrega" JSONB NOT NULL,
    "horaLimiteMismoDia" TEXT,
    "tiempoPreparacionDias" INTEGER NOT NULL DEFAULT 0,
    "permiteEntregaMismoDia" BOOLEAN NOT NULL DEFAULT true,
    "pesoMaximoKg" DECIMAL(65,30),
    "requiereDireccionCompleta" BOOLEAN NOT NULL DEFAULT true,
    "permiteArticulosFragiles" BOOLEAN NOT NULL DEFAULT true,
    "permitePagoContraEntrega" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "metodoPagoTransportista" TEXT,
    "frecuenciaFacturacion" TEXT,
    "responsableCoordinacion" TEXT,
    "instruccionesCoordinacion" TEXT,
    "transportistaId" TEXT NOT NULL,

    CONSTRAINT "CondicionesTransportista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportistaHistorial" (
    "id" TEXT NOT NULL,
    "entidadTipo" "TipoEntidadHistorialTransportista" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "TransportistaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZonaEntrega_instanciaId_idx" ON "ZonaEntrega"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "ZonaEntrega_instanciaId_nombre_key" ON "ZonaEntrega"("instanciaId", "nombre");

-- CreateIndex
CREATE INDEX "ZonaEntregaUbicacion_zonaEntregaId_idx" ON "ZonaEntregaUbicacion"("zonaEntregaId");

-- CreateIndex
CREATE INDEX "ZonaEntregaUbicacion_paisId_idx" ON "ZonaEntregaUbicacion"("paisId");

-- CreateIndex
CREATE INDEX "ServicioTransportista_transportistaId_idx" ON "ServicioTransportista"("transportistaId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioTransportista_transportistaId_nombre_key" ON "ServicioTransportista"("transportistaId", "nombre");

-- CreateIndex
CREATE INDEX "TarifaTransportistaZona_instanciaId_idx" ON "TarifaTransportistaZona"("instanciaId");

-- CreateIndex
CREATE INDEX "TarifaTransportistaZona_transportistaId_activa_idx" ON "TarifaTransportistaZona"("transportistaId", "activa");

-- CreateIndex
CREATE INDEX "TarifaTransportistaZona_zonaEntregaId_idx" ON "TarifaTransportistaZona"("zonaEntregaId");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaTransportistaZona_transportistaId_zonaEntregaId_servi_key" ON "TarifaTransportistaZona"("transportistaId", "zonaEntregaId", "servicioTransportistaId");

-- CreateIndex
CREATE UNIQUE INDEX "CondicionesTransportista_transportistaId_key" ON "CondicionesTransportista"("transportistaId");

-- CreateIndex
CREATE INDEX "TransportistaHistorial_instanciaId_idx" ON "TransportistaHistorial"("instanciaId");

-- CreateIndex
CREATE INDEX "TransportistaHistorial_entidadTipo_entidadId_idx" ON "TransportistaHistorial"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "EntregaCotizacion_zonaEntregaId_idx" ON "EntregaCotizacion"("zonaEntregaId");

-- CreateIndex
CREATE INDEX "EntregaCotizacion_servicioTransportistaId_idx" ON "EntregaCotizacion"("servicioTransportistaId");

-- CreateIndex
CREATE INDEX "EntregaCotizacion_tarifaTransportistaZonaId_idx" ON "EntregaCotizacion"("tarifaTransportistaZonaId");

-- CreateIndex
CREATE INDEX "EntregaPedido_zonaEntregaId_idx" ON "EntregaPedido"("zonaEntregaId");

-- CreateIndex
CREATE INDEX "EntregaPedido_servicioTransportistaId_idx" ON "EntregaPedido"("servicioTransportistaId");

-- CreateIndex
CREATE INDEX "EntregaPedido_tarifaTransportistaZonaId_idx" ON "EntregaPedido"("tarifaTransportistaZonaId");

-- AddForeignKey
ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_zonaEntregaId_fkey" FOREIGN KEY ("zonaEntregaId") REFERENCES "ZonaEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_servicioTransportistaId_fkey" FOREIGN KEY ("servicioTransportistaId") REFERENCES "ServicioTransportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_tarifaTransportistaZonaId_fkey" FOREIGN KEY ("tarifaTransportistaZonaId") REFERENCES "TarifaTransportistaZona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZonaEntrega" ADD CONSTRAINT "ZonaEntrega_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZonaEntregaUbicacion" ADD CONSTRAINT "ZonaEntregaUbicacion_zonaEntregaId_fkey" FOREIGN KEY ("zonaEntregaId") REFERENCES "ZonaEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZonaEntregaUbicacion" ADD CONSTRAINT "ZonaEntregaUbicacion_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioTransportista" ADD CONSTRAINT "ServicioTransportista_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaTransportistaZona" ADD CONSTRAINT "TarifaTransportistaZona_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaTransportistaZona" ADD CONSTRAINT "TarifaTransportistaZona_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaTransportistaZona" ADD CONSTRAINT "TarifaTransportistaZona_zonaEntregaId_fkey" FOREIGN KEY ("zonaEntregaId") REFERENCES "ZonaEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaTransportistaZona" ADD CONSTRAINT "TarifaTransportistaZona_servicioTransportistaId_fkey" FOREIGN KEY ("servicioTransportistaId") REFERENCES "ServicioTransportista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CondicionesTransportista" ADD CONSTRAINT "CondicionesTransportista_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportistaHistorial" ADD CONSTRAINT "TransportistaHistorial_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_zonaEntregaId_fkey" FOREIGN KEY ("zonaEntregaId") REFERENCES "ZonaEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_servicioTransportistaId_fkey" FOREIGN KEY ("servicioTransportistaId") REFERENCES "ServicioTransportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_tarifaTransportistaZonaId_fkey" FOREIGN KEY ("tarifaTransportistaZonaId") REFERENCES "TarifaTransportistaZona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Backfill: TransportistaCoberturaGeografica -> ZonaEntrega +
-- ZonaEntregaUbicacion + ServicioTransportista "Estándar" +
-- TarifaTransportistaZona (research.md Decisión 1, FR-052/053/054).
-- Preserva el 100% de la cobertura existente (SC-006) antes de retirar la
-- tabla vieja. Si no hay ninguna fila, cada INSERT siguiente es no-op.
--
-- Sin tablas temporales a propósito: la conexión de base de datos usada
-- por `prisma migrate deploy` puede cambiar de sesión física entre
-- sentencias cuando se conecta a través de un pooler en modo transacción
-- (ej. Supabase/PgBouncer) — una TEMP TABLE creada en una sentencia no es
-- visible en la siguiente. En su lugar, cada paso re-deriva la misma
-- asignación zona/servicio de forma determinística (misma partición +
-- ORDER BY estable) y hace join contra las filas ya confirmadas de
-- ZonaEntrega/ServicioTransportista por su clave natural.
-- ============================================================

-- Paso 1: una ZonaEntrega por cada (instancia, estado/provincia) distinto
-- ya cubierto por al menos un transportista — reutilizable entre
-- transportistas (FR-009). Nombre = nombre del estado, sufijado por
-- colisión si dos estados de países distintos comparten nombre dentro de
-- la misma instancia (mismo criterio que 021-alias-proveedores-ia).
INSERT INTO "ZonaEntrega" ("id", "nombre", "activa", "creadoEn", "actualizadoEn", "instanciaId")
SELECT
  gen_random_uuid()::text,
  CASE WHEN fila = 1 THEN nombre_estado ELSE nombre_estado || ' (' || fila || ')' END,
  true,
  now(),
  now(),
  "instanciaId"
FROM (
  SELECT DISTINCT t."instanciaId", ep."nombre" AS nombre_estado,
    ROW_NUMBER() OVER (PARTITION BY t."instanciaId", ep."nombre" ORDER BY c."estadoProvinciaId") AS fila
  FROM "TransportistaCoberturaGeografica" c
  JOIN "Transportista" t ON t."id" = c."transportistaId"
  JOIN "EstadoProvincia" ep ON ep."id" = c."estadoProvinciaId"
) numerado;

-- Paso 2: una ZonaEntregaUbicacion por cada ZonaEntrega recién creada,
-- resuelta por join contra la misma asignación determinística del Paso 1.
INSERT INTO "ZonaEntregaUbicacion" ("id", "zonaEntregaId", "paisId", "provinciaEstado")
SELECT gen_random_uuid()::text, ze."id", numerado."paisId", numerado.nombre_estado
FROM (
  SELECT DISTINCT t."instanciaId", c."paisId", ep."nombre" AS nombre_estado,
    ROW_NUMBER() OVER (PARTITION BY t."instanciaId", ep."nombre" ORDER BY c."estadoProvinciaId") AS fila
  FROM "TransportistaCoberturaGeografica" c
  JOIN "Transportista" t ON t."id" = c."transportistaId"
  JOIN "EstadoProvincia" ep ON ep."id" = c."estadoProvinciaId"
) numerado
JOIN "ZonaEntrega" ze
  ON ze."instanciaId" = numerado."instanciaId"
  AND ze."nombre" = CASE WHEN numerado.fila = 1 THEN numerado.nombre_estado ELSE numerado.nombre_estado || ' (' || numerado.fila || ')' END;

-- Paso 3: un ServicioTransportista "Estándar" por cada transportista que
-- tenía al menos una cobertura configurada (research.md Decisión 1) — los
-- transportistas creados desde ahora en más ya siembran sus 3 servicios en
-- el propio Server Action (crearTransportista), esto solo cubre a los
-- existentes.
INSERT INTO "ServicioTransportista" ("id", "nombre", "activo", "transportistaId")
SELECT gen_random_uuid()::text, 'Estándar', true, "transportistaId"
FROM (SELECT DISTINCT "transportistaId" FROM "TransportistaCoberturaGeografica") d;

-- Paso 4: una TarifaTransportistaZona por cada fila original de cobertura,
-- reproduciendo el mismo costo como costoInterno y precioCliente (spec019
-- no distinguía costo de precio — research.md Decisión 6). La zona y el
-- servicio se resuelven por su clave natural, ya confirmada en los pasos
-- anteriores.
INSERT INTO "TarifaTransportistaZona"
  ("id", "costoInterno", "precioCliente", "activa", "creadoEn", "actualizadoEn", "instanciaId", "transportistaId", "zonaEntregaId", "servicioTransportistaId")
SELECT
  gen_random_uuid()::text,
  c."costoEnvio",
  c."costoEnvio",
  c."activo",
  now(),
  now(),
  t."instanciaId",
  c."transportistaId",
  ze."id",
  st."id"
FROM "TransportistaCoberturaGeografica" c
JOIN "Transportista" t ON t."id" = c."transportistaId"
JOIN "EstadoProvincia" ep ON ep."id" = c."estadoProvinciaId"
JOIN "ZonaEntregaUbicacion" zeu
  ON zeu."paisId" = c."paisId" AND zeu."provinciaEstado" = ep."nombre"
JOIN "ZonaEntrega" ze
  ON ze."id" = zeu."zonaEntregaId" AND ze."instanciaId" = t."instanciaId"
JOIN "ServicioTransportista" st
  ON st."transportistaId" = c."transportistaId" AND st."nombre" = 'Estándar';

-- Paso 4: retirar TransportistaCoberturaGeografica — la pantalla/flujo de
-- cobertura país+provincia queda reemplazada por "Zonas y tarifas"
-- (Clarificación de sesión 2026-09-01, research.md Decisión 1). Recién
-- ahora, después de confirmar que cada fila fue migrada.

-- DropForeignKey
ALTER TABLE "TransportistaCoberturaGeografica" DROP CONSTRAINT "TransportistaCoberturaGeografica_estadoProvinciaId_fkey";

-- DropForeignKey
ALTER TABLE "TransportistaCoberturaGeografica" DROP CONSTRAINT "TransportistaCoberturaGeografica_paisId_fkey";

-- DropForeignKey
ALTER TABLE "TransportistaCoberturaGeografica" DROP CONSTRAINT "TransportistaCoberturaGeografica_transportistaId_fkey";

-- DropTable
DROP TABLE "TransportistaCoberturaGeografica";
