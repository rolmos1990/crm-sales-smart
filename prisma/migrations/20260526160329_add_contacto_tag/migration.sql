-- CreateTable
CREATE TABLE "ContactoTag" (
    "contactoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ContactoTag_pkey" PRIMARY KEY ("contactoId","tagId")
);

-- AddForeignKey
ALTER TABLE "ContactoTag" ADD CONSTRAINT "ContactoTag_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoTag" ADD CONSTRAINT "ContactoTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
