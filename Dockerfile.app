# ── Stage 1: Dependencias ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Variables públicas de Next.js — se inyectan en tiempo de build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_TEMPLATES_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_TEMPLATES_URL=$NEXT_PUBLIC_TEMPLATES_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar cliente Prisma antes del build de Next.js
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Runner de producción ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Usuario sin privilegios para mayor seguridad
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# su-exec: permite arrancar el contenedor como root (necesario para arreglar
# el dueño de /app/data, volumen persistente montado en runtime por Coolify,
# ver docker-entrypoint.sh) y recién ahí bajar privilegios a `nextjs` para
# ejecutar el proceso real — nunca corre nada de la app como root.
RUN apk add --no-cache su-exec

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/package.json         ./package.json
COPY --from=builder /app/node_modules         ./node_modules
COPY --from=builder /app/src/generated        ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
