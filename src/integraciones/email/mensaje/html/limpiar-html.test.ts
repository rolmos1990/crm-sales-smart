// 035 — Catálogo de seguridad de la limpieza de HTML (contracts/limpieza-html.md).
//
// Cada caso afirma la AUSENCIA de lo peligroso en la salida, no solo que la
// función no falle.
import { describe, expect, it } from "vitest";
import { limpiarHtmlEntrante, normalizarCid, prepararHtmlParaVista } from "./limpiar-html";
import { MAX_BYTES_HTML_ENTRADA } from "./politica";

function limpio(html: string): string {
  const r = limpiarHtmlEntrante(html);
  if (r.estado !== "DISPONIBLE") throw new Error(`se esperaba DISPONIBLE y vino ${r.estado}`);
  return r.html;
}

/** Ningún atributo de evento, en ninguna capitalización. */
const ATRIBUTO_EVENTO = /\son[a-z]+\s*=/i;

describe("limpiarHtmlEntrante — catálogo de seguridad", () => {
  it("1. correo comercial: conserva tablas, colores, listas y registra el cid", () => {
    const r = limpiarHtmlEntrante(`
      <table width="600" cellpadding="0" style="border-collapse:collapse;background-color:#f4f4f4">
        <tr><td align="center"><img src="cid:Logo@Banco" alt="Banco" width="120"></td></tr>
        <tr><td style="color:#333333;font-family:Arial,sans-serif;font-size:14px;padding:12px 24px">
          <h1 style="color:#0a58ca">Aviso importante</h1>
          <ol><li>Paso uno</li><li><b>Paso dos</b></li></ol>
          <a href="https://banco.example/ayuda" style="color:#fff;background-color:#0a58ca;padding:8px">Ver ayuda</a>
        </td></tr>
      </table>`);
    expect(r.estado).toBe("DISPONIBLE");
    if (r.estado !== "DISPONIBLE") return;
    expect(r.html).toContain("<table");
    expect(r.html).toContain("<ol>");
    expect(r.html).toContain("color:#0a58ca");
    expect(r.html).toContain("border-collapse:collapse");
    expect(r.html).toContain('src="cid:logo%40banco"');
    expect(r.cidsUsados).toEqual(["logo@banco"]);
    expect(r.imagenesExternas).toEqual([]);
  });

  it("2. elimina script en todas sus formas, incluido su texto", () => {
    const html = limpio(`
      <p>Hola</p>
      <script>alert('xss')</script>
      <script src="https://evil.test/x.js"></script>
      <SCRIPT>document.cookie</SCRIPT>
      <noscript><p>sin js</p></noscript>`);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain("alert");
    expect(html).not.toContain("document.cookie");
    expect(html).not.toContain("evil.test");
    expect(html).toContain("Hola");
  });

  it("3. elimina todos los atributos de evento", () => {
    const html = limpio(`
      <img src="cid:a" onerror="alert(1)">
      <div onclick="alert(2)" OnMouseOver="alert(3)">texto</div>
      <a href="https://ok.test" onfocus="alert(4)">enlace</a>
      <p onload = "alert(5)">p</p>`);
    expect(html).not.toMatch(ATRIBUTO_EVENTO);
    expect(html).not.toContain("alert");
    expect(html).toContain("texto");
  });

  it("4. elimina protocolos peligrosos en enlaces e imágenes", () => {
    const html = limpio(`
      <a href="javascript:alert(1)">a</a>
      <a href="JaVaScRiPt:alert(2)">b</a>
      <a href="&#106;avascript:alert(3)">c</a>
      <a href="java&#x09;script:alert(4)">d</a>
      <a href="data:text/html;base64,PHNjcmlwdD4=">e</a>
      <a href="vbscript:msgbox(1)">f</a>
      <a href="//evil.test/proto-relativo">g</a>
      <a href="file:///etc/passwd">h</a>
      <img src="data:image/svg+xml;base64,PHN2Zz4=">
      <img src="javascript:alert(5)">`);
    expect(html).not.toMatch(/javascript/i);
    expect(html).not.toMatch(/vbscript/i);
    expect(html).not.toMatch(/data:/i);
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("file:");
    expect(html).not.toContain("alert");
  });

  it("5. HTML malformado no rompe y sale bien formado", () => {
    const r = limpiarHtmlEntrante(`
      <div><p>sin cerrar <b>negrita <i>itálica</div>
      <td>celda suelta</td></tr></table>
      <img src="cid:x" alt="sin comillas>
      <!--[if mso]><v:rect><p>Outlook</p></v:rect><![endif]-->
      <p attr=">roto">fin`);
    expect(r.estado).toBe("DISPONIBLE");
    if (r.estado !== "DISPONIBLE") return;
    expect(r.html).not.toContain("<!--");
    expect(r.html).not.toMatch(/<v:/i);
    expect(r.html).toContain("fin");
  });

  it("6. neutraliza CSS peligroso y conserva el seguro", () => {
    const html = limpio(`
      <div style="color:red;background:url(https://track.test/p.gif)">a</div>
      <div style="width:expression(alert(1));font-weight:bold">b</div>
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999">c</div>
      <div style="background-image:url('javascript:alert(1)')">d</div>
      <div style="behavior:url(x.htc);-moz-binding:url(x.xml)">e</div>
      <div style="color:\\72 ed">f</div>
      <style>@import url(https://evil.test/x.css); body{display:none}</style>`);
    expect(html).not.toMatch(/url\(/i);
    expect(html).not.toMatch(/expression/i);
    expect(html).not.toMatch(/position/i);
    expect(html).not.toMatch(/z-index/i);
    expect(html).not.toMatch(/behavior|binding/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toContain("\\");
    expect(html).toContain("color:red");
    expect(html).toContain("font-weight:bold");
  });

  it("7. elimina SVG y MathML por completo", () => {
    const html = limpio(`
      <p>antes</p>
      <svg onload="alert(1)"><script>alert(2)</script><circle r="5"/></svg>
      <math><mtext><img src=x onerror=alert(3)></mtext></math>
      <p>después</p>`);
    expect(html).not.toMatch(/<svg|<math|<circle|<mtext/i);
    expect(html).not.toContain("alert");
    expect(html).toContain("antes");
    expect(html).toContain("después");
  });

  it("8. elimina formularios, marcos, objetos y metadatos", () => {
    const html = limpio(`
      <form action="https://evil.test"><input name="clave" type="password"><button>Entrar</button>
        <select><option>x</option></select><textarea>t</textarea></form>
      <iframe src="https://evil.test"></iframe><frame src="x"><object data="x.swf"></object>
      <embed src="x.swf"><applet code="x"></applet>
      <meta http-equiv="refresh" content="0;url=https://evil.test">
      <base href="https://evil.test/"><link rel="stylesheet" href="https://evil.test/x.css">
      <p>contenido</p>`);
    expect(html).not.toMatch(/<(form|input|button|select|option|textarea|iframe|frame|object|embed|applet|meta|base|link)\b/i);
    expect(html).not.toContain("evil.test");
    expect(html).toContain("contenido");
  });

  it("9. píxel de rastreo: queda sin src, marcado y registrado", () => {
    const r = limpiarHtmlEntrante(
      `<p>Hola</p><img src="https://t.test/p.gif?u=123" width="1" height="1">`,
    );
    expect(r.estado).toBe("DISPONIBLE");
    if (r.estado !== "DISPONIBLE") return;
    expect(r.html).not.toContain("t.test");
    expect(r.html).not.toMatch(/\ssrc=/);
    expect(r.html).toContain('data-karia-externa="0"');
    expect(r.imagenesExternas).toEqual(["https://t.test/p.gif?u=123"]);
  });

  it("10. HTML más grande que el límite → NO_DISPONIBLE / DEMASIADO_GRANDE", () => {
    const enorme = "<p>" + "a".repeat(MAX_BYTES_HTML_ENTRADA) + "</p>";
    expect(limpiarHtmlEntrante(enorme)).toEqual({ estado: "NO_DISPONIBLE", motivo: "DEMASIADO_GRANDE" });
  });

  it("11. anidamiento extremo → NO_DISPONIBLE / DEMASIADO_ANIDADO, rápido", () => {
    const anidado = "<div>".repeat(5000) + "x" + "</div>".repeat(5000);
    const inicio = Date.now();
    expect(limpiarHtmlEntrante(anidado)).toEqual({ estado: "NO_DISPONIBLE", motivo: "DEMASIADO_ANIDADO" });
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it("12. HTML que solo trae código → SIN_HTML / VACIO", () => {
    expect(limpiarHtmlEntrante("<script>x()</script><style>p{}</style>  ")).toEqual({
      estado: "SIN_HTML",
      motivo: "VACIO",
    });
  });

  it("13. todo enlace abre en pestaña nueva, sin origen ni control sobre Karia", () => {
    const html = limpio(`<a href="https://x.test" target="_self" rel="opener">ir</a><a href="mailto:a@b.test">mail</a>`);
    expect(html).toContain('href="https://x.test"');
    expect(html).toContain('href="mailto:a@b.test"');
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer nofollow"/g)).toHaveLength(2);
    expect(html).not.toContain("_self");
    expect(html).not.toMatch(/rel="opener"/);
  });

  it("14. no queda ninguna otra vía de carga remota", () => {
    const html = limpio(`
      <img src="cid:a" srcset="https://evil.test/a.png 2x">
      <picture><source srcset="https://evil.test/b.png"><img src="cid:b"></picture>
      <table background="https://evil.test/c.png"><tr><td background="https://evil.test/d.png">x</td></tr></table>
      <video src="https://evil.test/v.mp4" poster="https://evil.test/p.png"></video>
      <audio src="https://evil.test/a.mp3"></audio>
      <img src="cid:c" data-karia-externa="0">`);
    expect(html).not.toContain("evil.test");
    expect(html).not.toMatch(/srcset|background=|<source|<video|<audio|poster/i);
    // Una marca de imagen externa que trae el correo se descarta: solo Karia la pone.
    expect(html).not.toContain("data-karia-externa");
  });

  it("vacío, null o espacios → SIN_HTML sin motivo", () => {
    expect(limpiarHtmlEntrante(null)).toEqual({ estado: "SIN_HTML", motivo: null });
    expect(limpiarHtmlEntrante("   ")).toEqual({ estado: "SIN_HTML", motivo: null });
  });

  it("respeta el tope de imágenes externas", () => {
    const html = Array.from({ length: 60 }, (_, i) => `<img src="https://i.test/${i}.png">`).join("");
    const r = limpiarHtmlEntrante(html);
    expect(r.estado).toBe("DISPONIBLE");
    if (r.estado !== "DISPONIBLE") return;
    expect(r.imagenesExternas).toHaveLength(50);
    expect(r.html).not.toContain("i.test");
  });
});

describe("normalizarCid", () => {
  it("quita ángulos y prefijo, decodifica y pasa a minúsculas", () => {
    expect(normalizarCid("<Logo@Banco>")).toBe("logo@banco");
    expect(normalizarCid("cid:Logo%40Banco")).toBe("logo@banco");
  });
});

describe("prepararHtmlParaVista", () => {
  const urls = {
    urlCid: (cid: string) => (cid === "logo@banco" ? `https://app.test/api/correo-aislado/cid?t=${cid}` : null),
    urlImagenExterna: (n: number) => `https://app.test/api/correo-aislado/imagen?t=${n}`,
  };
  const guardado = limpio(
    `<img src="cid:Logo@Banco"><img src="cid:otro"><img src="https://t.test/p.gif"><a href="https://x.test">x</a>`,
  );

  it("sin permiso de imágenes, las externas quedan sin src", () => {
    const html = prepararHtmlParaVista(guardado, { ...urls, imagenes: false });
    expect(html).toContain('src="https://app.test/api/correo-aislado/cid?t=logo@banco"');
    expect(html).not.toContain("correo-aislado/imagen");
    expect(html).toContain('data-karia-externa="0"');
    expect(html).not.toContain("t.test");
  });

  it("con permiso de imágenes, las externas apuntan al proxy de Karia", () => {
    const html = prepararHtmlParaVista(guardado, { ...urls, imagenes: true });
    expect(html).toContain('src="https://app.test/api/correo-aislado/imagen?t=0"');
    expect(html).not.toContain("t.test");
  });

  it("un cid que no es de este correo queda sin src", () => {
    const html = prepararHtmlParaVista(guardado, { ...urls, imagenes: false });
    expect(html).not.toMatch(/cid:otro/);
  });

  it("defensa en profundidad: un HTML guardado alterado sale limpio igual", () => {
    const alterado = `${guardado}<script>alert(1)</script><img src="https://evil.test/x.png" onerror="alert(2)"><a href="javascript:alert(3)">x</a>`;
    const html = prepararHtmlParaVista(alterado, { ...urls, imagenes: true });
    expect(html).not.toMatch(/<script|onerror|javascript:|evil\.test/i);
    expect(html).not.toContain("alert");
  });
});
