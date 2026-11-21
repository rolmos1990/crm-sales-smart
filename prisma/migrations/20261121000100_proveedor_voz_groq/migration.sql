-- 050 — Groq (Whisper large v3 y v3 turbo) como proveedor de voz.
--
-- Solo agrega un valor al enum: ninguna fila existente cambia y nada que ya
-- esté guardado se reinterpreta.
ALTER TYPE "ProveedorVozEnum" ADD VALUE 'GROQ';
