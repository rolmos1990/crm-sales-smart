// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El proyecto usa un client.ts stub para type-checking sin DB.
  // Las queries reales funcionan en runtime via PrismaPg.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Baileys y dependencias nativas deben correr en Node.js, no en el bundler de webpack
  serverExternalPackages: ["@whiskeysockets/baileys", "pino", "pino-pretty"],
  experimental: {
    serverActions: {
      // La documentación del agente se sube por un server action y el default
      // de Next es 1 MB: sin esto, el tope de 20 MB por cuenta sería
      // decorativo porque nada más pesado que 1 MB llega a validarse.
      // 21 y no 20 para dejar margen al overhead del multipart.
      bodySizeLimit: "21mb",
    },
  },
};

module.exports = nextConfig;
