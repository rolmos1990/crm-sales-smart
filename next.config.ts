import type { NextConfig } from "next";

const isMock = process.env.USE_MOCK === "true";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    ...(isMock && {
      resolveAlias: {
        "@/shared/db/prisma": "./src/mocks/db-export.ts",
      },
    }),
  },
};

export default nextConfig;
