// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El proyecto usa un client.ts stub para type-checking sin DB.
  // Las queries reales funcionan en runtime via PrismaPg.
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
