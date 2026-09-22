# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci --include=dev
RUN npm --prefix client ci --include=dev
RUN npm --prefix server ci --include=dev

COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev && npm cache clean --force
RUN ln -s /app/server/node_modules /app/node_modules

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/db/migrations ./server/dist/server/db/migrations
COPY --from=build /app/server/db/migrations ./server/db/migrations

RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown -R app:app /data /app
USER app

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/dist/server/index.js"]
