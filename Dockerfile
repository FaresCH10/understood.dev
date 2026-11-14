FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/supervisor/package.json apps/supervisor/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
COPY packages/ui/package.json packages/ui/package.json
ENV MONGOMS_DISABLE_POSTINSTALL=true
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build --workspace @understood/api

RUN npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/design-tokens ./packages/design-tokens
COPY --from=build /app/packages/ui ./packages/ui
RUN mkdir -p /data/media && chown -R node:node /data /app

USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
