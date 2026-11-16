// 035 — Catálogo SSRF del proxy de imágenes (contracts/proxy-imagenes.md).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { descargarImagenSegura, type DependenciasProxy } from "./proxy-imagen";

let servidor: http.Server;
let puerto = 0;
let png: Buffer;
let ultimasCabeceras: http.IncomingHttpHeaders = {};

beforeAll(async () => {
  png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#ff0000" } }).png().toBuffer();
  servidor = http.createServer((req, res) => {
    ultimasCabeceras = req.headers;
    const ruta = req.url ?? "/";
    if (ruta === "/ok.png") {
      res.writeHead(200, { "Content-Type": "image/png" }).end(png);
    } else if (ruta === "/html") {
      res.writeHead(200, { "Content-Type": "text/html" }).end("<script>x</script>");
    } else if (ruta === "/svg") {
      res.writeHead(200, { "Content-Type": "image/svg+xml" }).end('<svg xmlns="http://www.w3.org/2000/svg"/>');
    } else if (ruta === "/falso.png") {
      res.writeHead(200, { "Content-Type": "image/png" }).end("<html><body>no soy una imagen</body></html>");
    } else if (ruta === "/enorme") {
      // Sin Content-Length: el tope tiene que cortar leyendo.
      res.writeHead(200, { "Content-Type": "image/png" });
      const trozo = Buffer.alloc(64 * 1024, 1);
      let enviados = 0;
      const escribir = () => {
        while (enviados < 6 * 1024 * 1024) {
          enviados += trozo.length;
          if (!res.write(trozo)) return res.once("drain", escribir);
        }
        res.end();
      };
      escribir();
    } else if (ruta === "/declarado-enorme") {
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": String(50 * 1024 * 1024) });
      res.end();
    } else if (ruta === "/lento") {
      // No responde nunca.
    } else if (ruta === "/a-interna") {
      res.writeHead(302, { Location: "http://10.0.0.1/secreto" }).end();
    } else if (ruta.startsWith("/salto/")) {
      const n = Number(ruta.split("/")[2]);
      res.writeHead(302, { Location: n > 0 ? `/salto/${n - 1}` : "/ok.png" }).end();
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  puerto = (servidor.address() as AddressInfo).port;
});

afterAll(async () => {
  servidor.closeAllConnections();
  await new Promise<void>((r) => servidor.close(() => r()));
});

/** Dependencias para hablar con el servidor local: el "dominio" resuelve a 127.0.0.1. */
function local(extra: Partial<DependenciasProxy> = {}): DependenciasProxy {
  return {
    permitirDestinoDePrueba: true,
    resolver: async () => [{ address: "127.0.0.1", family: 4 }],
    ...extra,
  };
}
const url = (ruta: string) => `http://imagenes.test:${puerto}${ruta}`;

describe("descargarImagenSegura — catálogo SSRF", () => {
  it("1. imagen pública válida → webp generado por Karia", async () => {
    const r = await descargarImagenSegura(url("/ok.png"), local());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.webp.subarray(8, 12).toString("latin1")).toBe("WEBP");
  });

  it.each(["http://127.0.0.1/", "http://localhost/", "http://[::1]/", "http://0.0.0.0/"])(
    "2. loopback %s → DIRECCION_BLOQUEADA",
    async (u) => {
      const r = await descargarImagenSegura(u, { resolver: async () => [{ address: "127.0.0.1", family: 4 }] });
      expect(r).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
    },
  );

  it.each(["http://169.254.169.254/latest/meta-data", "http://[fd00:ec2::254]/"])(
    "3. metadatos de nube %s → DIRECCION_BLOQUEADA",
    async (u) => {
      expect(await descargarImagenSegura(u)).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
    },
  );

  it.each([
    "http://10.1.2.3/", "http://172.16.0.1/", "http://192.168.0.10/", "http://100.64.0.1/",
    "http://[::ffff:10.0.0.1]/", "http://[fc00::1]/", "http://[fe80::1]/",
  ])("4. red privada %s → DIRECCION_BLOQUEADA", async (u) => {
    expect(await descargarImagenSegura(u)).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
  });

  it("5. un nombre público que resuelve a una IP privada → DIRECCION_BLOQUEADA", async () => {
    const r = await descargarImagenSegura("https://cdn.publico.test/a.png", {
      resolver: async () => [{ address: "192.168.1.20", family: 4 }],
    });
    expect(r).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
  });

  it("6. DNS rebinding: se resuelve una vez por salto y se conecta a la IP validada", async () => {
    let llamadas = 0;
    const resolver = vi.fn(async () => {
      llamadas += 1;
      // Si el código volviera a resolver al conectar, recibiría una IP interna.
      return llamadas === 1 ? [{ address: "127.0.0.1", family: 4 }] : [{ address: "10.0.0.1", family: 4 }];
    });
    const r = await descargarImagenSegura(url("/ok.png"), { permitirDestinoDePrueba: true, resolver });
    expect(r.ok).toBe(true);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("7. un nombre con varias IPs, una privada → DIRECCION_BLOQUEADA", async () => {
    const r = await descargarImagenSegura("https://mixto.test/a.png", {
      resolver: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ],
    });
    expect(r).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
  });

  it("8. redirección hacia una IP interna → DIRECCION_BLOQUEADA", async () => {
    expect(await descargarImagenSegura(url("/a-interna"), local())).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
  });

  it("9. más de 3 redirecciones → DEMASIADAS_REDIRECCIONES (3 sí se siguen)", async () => {
    expect((await descargarImagenSegura(url("/salto/2"), local())).ok).toBe(true);
    expect(await descargarImagenSegura(url("/salto/4"), local())).toEqual({ ok: false, motivo: "DEMASIADAS_REDIRECCIONES" });
  });

  it("10. una página HTML → TIPO_NO_ADMITIDO", async () => {
    expect(await descargarImagenSegura(url("/html"), local())).toEqual({ ok: false, motivo: "TIPO_NO_ADMITIDO" });
  });

  it("11. SVG → TIPO_NO_ADMITIDO", async () => {
    expect(await descargarImagenSegura(url("/svg"), local())).toEqual({ ok: false, motivo: "TIPO_NO_ADMITIDO" });
  });

  it("12. image/png cuyo contenido es HTML → TIPO_NO_ADMITIDO", async () => {
    expect(await descargarImagenSegura(url("/falso.png"), local())).toEqual({ ok: false, motivo: "TIPO_NO_ADMITIDO" });
  });

  it("13. cuerpo de 6 MB sin Content-Length, o declarado enorme → DEMASIADO_GRANDE", async () => {
    expect(await descargarImagenSegura(url("/enorme"), local())).toEqual({ ok: false, motivo: "DEMASIADO_GRANDE" });
    expect(await descargarImagenSegura(url("/declarado-enorme"), local())).toEqual({ ok: false, motivo: "DEMASIADO_GRANDE" });
  });

  it("14. un servidor que no responde → TIEMPO_EXCEDIDO", async () => {
    const inicio = Date.now();
    const r = await descargarImagenSegura(url("/lento"), local({ tiempoMaximoMs: 500 }));
    expect(r).toEqual({ ok: false, motivo: "TIEMPO_EXCEDIDO" });
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it.each([
    ["ftp://imagenes.test/a.png", "ESQUEMA"],
    ["file:///etc/passwd", "ESQUEMA"],
    ["gopher://imagenes.test/", "ESQUEMA"],
    ["javascript:alert(1)", "ESQUEMA"],
    ["no es una url", "ESQUEMA"],
    ["http://usuario:clave@imagenes.test/a.png", "CREDENCIALES_EN_URL"],
    ["http://imagenes.test:8080/a.png", "PUERTO"],
  ])("15. %s → %s", async (u, motivo) => {
    const r = await descargarImagenSegura(u, { resolver: async () => [{ address: "93.184.216.34", family: 4 }] });
    expect(r).toEqual({ ok: false, motivo });
  });

  it("16. la petición saliente no lleva cookies, Authorization ni Referer", async () => {
    await descargarImagenSegura(url("/ok.png"), local());
    expect(ultimasCabeceras.cookie).toBeUndefined();
    expect(ultimasCabeceras.authorization).toBeUndefined();
    expect(ultimasCabeceras.referer).toBeUndefined();
    expect(ultimasCabeceras["user-agent"]).toBe("KariaImageProxy/1.0");
  });

  it("sin la opción de prueba, el servidor local (loopback) también está bloqueado", async () => {
    const r = await descargarImagenSegura(url("/ok.png"), { resolver: async () => [{ address: "127.0.0.1", family: 4 }] });
    expect(r).toEqual({ ok: false, motivo: "PUERTO" });
    const r2 = await descargarImagenSegura("http://imagenes.test/ok.png", {
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    expect(r2).toEqual({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
  });
});
