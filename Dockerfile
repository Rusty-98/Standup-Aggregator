# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json server/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/db/migrations ./server/dist/db/migrations

RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown -R app:app /data /app
USER app

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/dist/index.js"]
