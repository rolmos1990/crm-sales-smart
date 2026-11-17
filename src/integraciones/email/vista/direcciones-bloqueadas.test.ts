import { describe, expect, it } from "vitest";
import { esDireccionBloqueada } from "./direcciones-bloqueadas";

describe("esDireccionBloqueada", () => {
  it.each([
    "127.0.0.1", "127.255.255.254", "0.0.0.0", "10.0.0.1", "10.255.255.255",
    "100.64.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "192.0.0.8", "192.0.2.1", "198.18.0.1", "198.51.100.7", "203.0.113.9",
    "224.0.0.1", "239.255.255.250", "240.0.0.1", "255.255.255.255",
  ])("bloquea IPv4 interna o reservada %s", (ip) => {
    expect(esDireccionBloqueada(ip)).toBe(true);
  });

  it.each([
    "::", "::1", "[::1]", "fc00::1", "fd00:ec2::254", "fe80::1", "fe80::1%eth0", "ff02::1",
    "64:ff9b::a9fe:a9fe", "2001:db8::1", "100::1",
  ])("bloquea IPv6 interna o reservada %s", (ip) => {
    expect(esDireccionBloqueada(ip)).toBe(true);
  });

  it.each(["::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "::ffff:7f00:1", "::FFFF:192.168.0.1"])(
    "bloquea IPv4 interna mapeada en IPv6 %s",
    (ip) => {
      expect(esDireccionBloqueada(ip)).toBe(true);
    },
  );

  it.each(["no-es-ip", "", "999.1.1.1", "localhost"])("una dirección ilegible cuenta como bloqueada: %s", (ip) => {
    expect(esDireccionBloqueada(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])(
    "permite IP pública %s",
    (ip) => {
      expect(esDireccionBloqueada(ip)).toBe(false);
    },
  );
});
