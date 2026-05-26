import { NextResponse } from "next/server";
import { ejecutarJobsPendientes } from "@/crm/pipeline/disparadores/ejecutor";

// Proteger en producción con WORKER_SECRET en el header x-worker-secret
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (secret !== process.env["WORKER_SECRET"] && process.env["NODE_ENV"] === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultado = await ejecutarJobsPendientes();
  return NextResponse.json(resultado);
}
