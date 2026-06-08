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

# App source. Only the backend apps (web + bot) — NOT apps/app (the Expo/RN console),
# whose heavy dep tree isn't needed here and, if copied in uninstalled, makes pnpm run a
# full install at boot (which OOM-kills the small container).
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/bot ./apps/bot

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# On boot: apply migrations, seed (idempotent), then start the web server.
CMD ["sh", "-c", "pnpm --filter @kluche/db migrate && pnpm --filter @kluche/web seed && pnpm --filter @kluche/web start"]
