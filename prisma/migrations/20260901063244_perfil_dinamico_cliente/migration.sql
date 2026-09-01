-- CreateTable
CREATE TABLE "PerfilClienteSnapshot" (
    "id" TEXT NOT NULL,
    "tipoRelacion" TEXT NOT NULL,
    "datosObjetivos" JSONB NOT NULL,
    "datosInterpretados" JSONB,
    "senalesObjetivas" JSONB NOT NULL,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disparadoPor" TEXT,
    "contactoId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "PerfilClienteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilClienteSnapshot_contactoId_key" ON "PerfilClienteSnapshot"("contactoId");

-- CreateIndex
CREATE INDEX "PerfilClienteSnapshot_instanciaId_idx" ON "PerfilClienteSnapshot"("instanciaId");

-- AddForeignKey
ALTER TABLE "PerfilClienteSnapshot" ADD CONSTRAINT "PerfilClienteSnapshot_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilClienteSnapshot" ADD CONSTRAINT "PerfilClienteSnapshot_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
