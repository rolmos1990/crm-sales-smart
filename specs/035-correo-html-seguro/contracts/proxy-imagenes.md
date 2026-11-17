# Contrato: descarga segura de imágenes externas

Ubicación: `src/integraciones/email/vista/proxy-imagen.ts`. Solo corre en el servidor Next, nunca en el
worker.

```ts
type RechazoProxy =
  | "ESQUEMA" | "PUERTO" | "CREDENCIALES_EN_URL" | "DIRECCION_BLOQUEADA" | "DNS"
  | "DEMASIADAS_REDIRECCIONES" | "ESTADO_HTTP" | "TIPO_NO_ADMITIDO" | "DEMASIADO_GRANDE"
  | "TIEMPO_EXCEDIDO" | "IMAGEN_INVALIDA";

descargarImagenSegura(url: string, deps?: { lookup?: LookupFn; ahora?: () => number })
  : Promise<{ ok: true; webp: Buffer } | { ok: false; motivo: RechazoProxy }>

esDireccionBloqueada(ip: string): boolean     // net.BlockList, IPv4 + IPv6 + IPv4 mapeado
```

`deps.lookup` se puede inyectar para las pruebas de DNS rebinding. En producción se usa `dns.lookup`.

## Límites

| Parámetro | Valor |
|---|---|
| Esquemas | `http`, `https` |
| Puertos | 80, 443 (también los implícitos) |
| Redirecciones | 3 como máximo, y cada una se revalida completa |
| Tiempo total | 5 s |
| Tamaño | 5 MB. Se corta el flujo al pasarse |
| Tipos | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, verificados también por bytes mágicos |
| Salida | webp re-codificado con `sharp`, con `limitInputPixels: 40_000_000` |
| Cabeceras enviadas | Solo `User-Agent: KariaImageProxy/1.0` y `Accept: image/*` |

## Catálogo de pruebas obligatorio (`proxy-imagen.test.ts`)

Se usa un servidor HTTP local de prueba y un `lookup` inyectado.

| # | Caso | Esperado |
|---|---|---|
| 1 | Imagen PNG pública válida | `ok`, webp |
| 2 | `http://127.0.0.1/`, `http://localhost/`, `http://[::1]/`, `http://0.0.0.0/` | `DIRECCION_BLOQUEADA` |
| 3 | `http://169.254.169.254/latest/meta-data`, `http://[fd00:ec2::254]/` | `DIRECCION_BLOQUEADA` |
| 4 | `10.x`, `172.16.x`, `192.168.x`, `100.64.x`, `[::ffff:10.0.0.1]`, `[fc00::1]`, `[fe80::1]` | `DIRECCION_BLOQUEADA` |
| 5 | Nombre que resuelve a una IP privada | `DIRECCION_BLOQUEADA` |
| 6 | DNS rebinding: la primera resolución es pública y la segunda privada | La conexión va a la IP validada, nunca hay segunda resolución sin validar |
| 7 | Nombre que resuelve a varias IP, una de ellas privada | `DIRECCION_BLOQUEADA` |
| 8 | Redirección 302 hacia `127.0.0.1` | `DIRECCION_BLOQUEADA` |
| 9 | 4 redirecciones encadenadas | `DEMASIADAS_REDIRECCIONES` |
| 10 | `Content-Type: text/html` | `TIPO_NO_ADMITIDO` |
| 11 | `image/svg+xml` | `TIPO_NO_ADMITIDO` |
| 12 | `image/png` cuyo cuerpo es HTML (bytes mágicos falsos) | `TIPO_NO_ADMITIDO` |
| 13 | Cuerpo de 6 MB sin `Content-Length` | `DEMASIADO_GRANDE`, sin leer más de 5 MB + 64 KB |
| 14 | Servidor que no responde | `TIEMPO_EXCEDIDO` en ≤ 5,5 s |
| 15 | `ftp://`, `file:///etc/passwd`, `gopher://`, `http://user:pass@host/`, `http://host:8080/` | `ESQUEMA` / `CREDENCIALES_EN_URL` / `PUERTO` |
| 16 | La petición saliente no lleva `Cookie`, `Authorization` ni `Referer` | Verificado en el servidor de prueba |
