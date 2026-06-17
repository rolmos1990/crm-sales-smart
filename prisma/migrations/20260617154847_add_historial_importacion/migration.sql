-- CreateEnum
CREATE TYPE "EstadoImportacion" AS ENUM ('EN_PROCESO', 'COMPLETADO', 'COMPLETADO_CON_ERRORES', 'FALLIDO');

-- CreateTable
CREATE TABLE "HistorialImportacion" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoTipo" TEXT NOT NULL,
    "archivoPeso" INTEGER NOT NULL,
    "totalRegistros" INTEGER NOT NULL,
    "registrosExitosos" INTEGER NOT NULL,
    "registrosConError" INTEGER NOT NULL,
    "errores" JSONB NOT NULL,
    "estado" "EstadoImportacion" NOT NULL DEFAULT 'EN_PROCESO',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "HistorialImportacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistorialImportacion_instanciaId_idx" ON "HistorialImportacion"("instanciaId");

-- CreateIndex
CREATE INDEX "HistorialImportacion_fechaCreacion_idx" ON "HistorialImportacion"("fechaCreacion");

-- AddForeignKey
ALTER TABLE "HistorialImportacion" ADD CONSTRAINT "HistorialImportacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
