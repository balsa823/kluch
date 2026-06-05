# Kluch backend (apps/web) — multi-tenant agency sites + console + APIs
FROM node:22-slim

# pnpm via corepack
RUN corepack enable

WORKDIR /app

# Install workspace deps first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
RUN pnpm install --frozen-lockfile

# App source
COPY packages ./packages
COPY apps ./apps

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# On boot: apply migrations, seed (idempotent), then start the web server.
CMD ["sh", "-c", "pnpm --filter @kluch/db migrate && pnpm --filter @kluch/web seed && pnpm --filter @kluch/web start"]
