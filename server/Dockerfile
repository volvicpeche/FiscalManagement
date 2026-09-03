# syntax=docker/dockerfile:1
#
# Build context is the repo root (npm workspaces need the root
# package-lock.json plus every workspace's package.json to install).

# ---------- build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
COPY shared/package.json shared/package.json
RUN npm ci -w server -w shared

COPY shared shared
COPY server server

RUN npm run build --workspace=server
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    DISPLAY=:99 \
    CHROME_NO_SANDBOX=true

# patchright drives the real "chrome" channel in headed mode, off-screen
# (see src/services/browserFetch.ts) — Google Chrome isn't the bundled
# Chromium, and Xvfb gives headed Chrome a display to render into.
RUN apt-get update && apt-get install -y --no-install-recommends \
      wget gnupg ca-certificates xvfb fonts-liberation \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

WORKDIR /app/server
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/server/src/index.js"]
