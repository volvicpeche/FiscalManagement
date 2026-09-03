# syntax=docker/dockerfile:1
#
# Build context is the repo root (npm workspaces need the root
# package-lock.json plus every workspace's package.json to install).

# ---------- build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci -w client -w shared

COPY shared shared
COPY client client

RUN npm run build --workspace=client

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/client/dist /usr/share/nginx/html
EXPOSE 80
