# ============================================================
# Planning App — Dockerfile (Astro SSR + Node.js)
# ============================================================
# Multi-stage build: install → build → runtime (slim)

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- Stage 2: Build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Astro PUBLIC_* zmienne muszą być dostępne w czasie buildu (Vite je wbudowuje w kod)
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG PUBLIC_MICROSOFT_CLIENT_ID
ARG PUBLIC_MICROSOFT_TENANT_ID
ARG PUBLIC_SENTRY_DSN

RUN npm run build

# --- Stage 3: Runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app

# Bezpieczeństwo: nie uruchamiaj jako root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S astro -u 1001 -G nodejs

# Kopiuj tylko production dependencies i zbudowany kod
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Astro standalone wymaga package.json w runtime
COPY --from=build /app/package.json ./package.json

USER astro

ENV HOST=0.0.0.0
ENV PORT=${PORT:-4321}
ENV NODE_ENV=production

EXPOSE ${PORT:-4321}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4321}/api/v1/health || exit 1

CMD ["node", "dist/server/entry.mjs"]
