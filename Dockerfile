# syntax=docker/dockerfile:1
FROM node:26-alpine AS build
# corepack installs exactly the pnpm pinned by `packageManager`, so the image, CI and local
# development all agree on one version.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Manifests first so the dependency layer survives source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:26-alpine
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# --ignore-scripts is redundant while `allowBuilds` lists only esbuild (a build-time
# dependency), but it states the intent: since scrypt replaced bcrypt the production tree
# is pure JavaScript, so nothing here has to compile and nothing gets to run on install.
RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

COPY server.js .
COPY src ./src

COPY --from=build /app/dist ./dist

# /data is the default EASYPAGES_DATA_DIR: session secret and credentials live there. It is
# created and chowned here so the image works even when nothing is mounted over it.
RUN mkdir -p /data && chown -R node:node /app /data

USER node

ENV NODE_ENV=production
ENV PORT=8002
ENV EASYPAGES_DATA_DIR=/data
EXPOSE 8002

# Defined in the image, not only in docker-compose.yml, so a user's stale compose file is
# not the only place the probe lives.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8002/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `node server.js` rather than `pnpm start`: one process fewer, correct signal handling, and
# no package manager in the runtime path.
CMD ["node", "server.js"]
