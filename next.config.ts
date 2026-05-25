import type { NextConfig } from "next";
import path from "path";

const isMock = process.env.USE_MOCK === "true";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    ...(isMock && {
      resolveAlias: {
        // En modo mock, cualquier import de la capa de datos usa el mock.
        // Turbopack intercepta antes de resolver tsconfig paths, por lo que
        // los queries.ts y actions.ts nunca llegan a cargar el cliente real.
        "@/shared/db/prisma": path.resolve(__dirname, "src/mocks/db-export.ts"),
      },
    }),
  },
};

export default nextConfig;
