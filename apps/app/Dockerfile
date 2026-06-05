# Kluch Expo console — builds the web export inside the image, serves via nginx.
# Build context MUST be the repo root (the Expo build needs the pnpm workspace).
#   docker build -f apps/app/Dockerfile -t kluch-app .

# ---- build stage: produce the static web export ----
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo

# Workspace manifests + config first (better layer caching). .npmrc carries
# node-linker=hoisted, which Expo/Metro need.
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json   packages/db/
COPY packages/core/package.json packages/core/
COPY apps/web/package.json      apps/web/
COPY apps/bot/package.json      apps/bot/
COPY apps/app/package.json      apps/app/
RUN pnpm install --frozen-lockfile

# Source
COPY packages ./packages
COPY apps ./apps

# API base URL is inlined into the bundle at build time.
ARG EXPO_PUBLIC_API_URL=http://localhost:8080
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
WORKDIR /repo/apps/app
RUN pnpm exec expo export --platform web --output-dir dist

# ---- serve stage ----
FROM nginx:alpine
COPY apps/app/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/app/dist /usr/share/nginx/html
EXPOSE 80
