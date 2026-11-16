// 035 — Direcciones a las que el proxy de imágenes NUNCA se conecta (SSRF).
//
// Loopback, redes privadas, enlace local, CGNAT, metadatos de nube,
// documentación, multicast y reservadas. Se compara la IP YA RESUELTA, no el
// nombre: un nombre público puede resolver a una IP interna.
import { BlockList, isIP } from "node:net";

const bloqueadas = new BlockList();

const IPV4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // incluye 169.254.169.254 (metadatos de nube)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4], // incluye 255.255.255.255
];

const IPV6: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7], // incluye fd00:ec2::254 (metadatos de AWS por IPv6)
  ["fe80::", 10],
  ["ff00::", 8],
];

for (const [red, prefijo] of IPV4) bloqueadas.addSubnet(red, prefijo, "ipv4");
for (const [red, prefijo] of IPV6) bloqueadas.addSubnet(red, prefijo, "ipv6");

/** IPv4 contenida en una IPv6 mapeada (::ffff:a.b.c.d o ::ffff:XXXX:XXXX). */
function ipv4Mapeada(ip: string): string | null {
  const minus = ip.toLowerCase();
  if (!minus.startsWith("::ffff:")) return null;
  const resto = minus.slice("::ffff:".length);
  if (isIP(resto) === 4) return resto;
  const partes = resto.split(":");
  if (partes.length !== 2 || !partes.every((p) => /^[0-9a-f]{1,4}$/.test(p))) return null;
  const alto = parseInt(partes[0], 16);
  const bajo = parseInt(partes[1], 16);
  return `${alto >> 8}.${alto & 255}.${bajo >> 8}.${bajo & 255}`;
}

/** true si el proxy no debe conectarse a esta IP. Una IP ilegible cuenta como bloqueada. */
export function esDireccionBloqueada(ip: string): boolean {
  const limpia = ip.replace(/^\[|\]$/g, "").split("%")[0];
  const version = isIP(limpia);
  if (version === 0) return true;
  if (version === 4) return bloqueadas.check(limpia, "ipv4");

  const mapeada = ipv4Mapeada(limpia);
  if (mapeada) return bloqueadas.check(mapeada, "ipv4");
  // Cualquier otra forma de ::ffff:0:0/96 que no se pudo leer se bloquea.
  if (limpia.toLowerCase().startsWith("::ffff:")) return true;
  return bloqueadas.check(limpia, "ipv6");
}
