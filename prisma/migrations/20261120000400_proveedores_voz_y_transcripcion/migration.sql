-- 049-proveedores-de-voz
--
-- Todo aditivo y con DEFAULT: no requiere backfill ni ventana de escritura.
-- En PostgreSQL >= 11 agregar una columna NOT NULL con default no reescribe
-- la tabla, así que MediaArchivo (decenas de miles de filas) no se bloquea.

-- ── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "ProveedorVozEnum" AS ENUM ('ELEVENLABS', 'OPENAI', 'LOCAL');

-- INAUDIBLE es terminal y distinto de ERROR a propósito: el audio no tenía
-- habla. Reintentarlo cuesta dinero y devuelve el mismo silencio.
CREATE TYPE "EstadoTranscripcion" AS ENUM ('NO_APLICA', 'PENDIENTE', 'PROCESANDO', 'LISTO', 'INAUDIBLE', 'ERROR');

-- ── ProveedorVoz ─────────────────────────────────────────────────────────
CREATE TABLE "ProveedorVoz" (
    "id"               TEXT NOT NULL,
    "alias"            TEXT NOT NULL,
    "aliasNormalizado" TEXT NOT NULL,
    "proveedor"        "ProveedorVozEnum" NOT NULL,
    "apiKeyEncriptada" TEXT,
    "baseUrl"          TEXT,
    "modelo"           TEXT NOT NULL DEFAULT 'scribe_v3',
    "activo"           BOOLEAN NOT NULL DEFAULT true,
    "prioridad"        INTEGER NOT NULL DEFAULT 1,
    "costoPorHora"     DECIMAL(65,30),
    "limiteMinutosDia" INTEGER,
    "timeoutMs"        INTEGER NOT NULL DEFAULT 30000,
    "reintentosMax"    INTEGER NOT NULL DEFAULT 2,
    "creadoEn"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn"    TIMESTAMP(3) NOT NULL,
    "instanciaId"      TEXT NOT NULL,

    CONSTRAINT "ProveedorVoz_pkey" PRIMARY KEY ("id")
);

-- El índice único es el resguardo de carrera del chequeo de alias duplicado
-- que hace la Server Action antes de escribir (mismo patrón que 021).
CREATE UNIQUE INDEX "ProveedorVoz_instanciaId_aliasNormalizado_key" ON "ProveedorVoz"("instanciaId", "aliasNormalizado");
CREATE INDEX "ProveedorVoz_instanciaId_idx" ON "ProveedorVoz"("instanciaId");
CREATE INDEX "ProveedorVoz_instanciaId_activo_prioridad_idx" ON "ProveedorVoz"("instanciaId", "activo", "prioridad");

ALTER TABLE "ProveedorVoz" ADD CONSTRAINT "ProveedorVoz_instanciaId_fkey"
    FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── UsoVoz ───────────────────────────────────────────────────────────────
CREATE TABLE "UsoVoz" (
    "id"             TEXT NOT NULL,
    "modelo"         TEXT NOT NULL,
    "segundos"       INTEGER NOT NULL DEFAULT 0,
    "costoEstimado"  DECIMAL(65,30),
    "tiempoMs"       INTEGER NOT NULL DEFAULT 0,
    "exito"          BOOLEAN NOT NULL DEFAULT true,
    "error"          TEXT,
    "entidadTipo"    TEXT,
    "entidadId"      TEXT,
    "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId"    TEXT NOT NULL,
    "proveedorVozId" TEXT,

    CONSTRAINT "UsoVoz_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsoVoz_instanciaId_creadoEn_idx" ON "UsoVoz"("instanciaId", "creadoEn");
CREATE INDEX "UsoVoz_proveedorVozId_idx" ON "UsoVoz"("proveedorVozId");

ALTER TABLE "UsoVoz" ADD CONSTRAINT "UsoVoz_instanciaId_fkey"
    FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SetNull y no Cascade: borrar un proveedor no puede borrar el histórico de
-- gasto que ya se facturó.
ALTER TABLE "UsoVoz" ADD CONSTRAINT "UsoVoz_proveedorVozId_fkey"
    FOREIGN KEY ("proveedorVozId") REFERENCES "ProveedorVoz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Transcripción en MediaArchivo ────────────────────────────────────────
ALTER TABLE "MediaArchivo"
    ADD COLUMN "transcripcion"               TEXT,
    ADD COLUMN "transcripcionEstado"         "EstadoTranscripcion" NOT NULL DEFAULT 'NO_APLICA',
    ADD COLUMN "transcripcionIdioma"         TEXT,
    ADD COLUMN "transcripcionSegundos"       INTEGER,
    ADD COLUMN "transcripcionIntentos"       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "transcripcionBloqueadoHasta" TIMESTAMP(3),
    ADD COLUMN "transcripcionProveedorVozId" TEXT,
    ADD COLUMN "transcripcionEn"             TIMESTAMP(3);

-- Índice PARCIAL, escrito a mano porque el DSL de Prisma no expresa el WHERE
-- (misma convención que ContactoAnalisisCola en 042).
--
-- Es parcial a propósito: MediaArchivo guarda sobre todo imágenes, que quedan
-- en NO_APLICA para siempre. Sin el WHERE, el índice de la cola pesaría el
-- tamaño de toda la tabla para servir una consulta que solo mira audios
-- pendientes.
CREATE INDEX "MediaArchivo_transcripcion_pendiente_idx"
    ON "MediaArchivo" ("instanciaId", "transcripcionBloqueadoHasta")
    WHERE "transcripcionEstado" = 'PENDIENTE';

-- ── Interruptor por cuenta ───────────────────────────────────────────────
-- Apagado por defecto: encender la feature es una decisión explícita del
-- comercio, porque implica mandar el audio de sus conversaciones a un tercero
-- y gastar su saldo.
ALTER TABLE "ConfiguracionEmpresa"
    ADD COLUMN "transcripcionVozHabilitada" BOOLEAN NOT NULL DEFAULT false;
