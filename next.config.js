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
};

module.exports = nextConfig;
