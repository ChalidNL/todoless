######## Backend API for TodoLess ########
# Multi-stage build using Debian slim to leverage glibc prebuilt better-sqlite3 binaries.

FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies (always prefer npm lock if present)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    else npm install; fi

# Copy source and build TypeScript
COPY . .
RUN npm run build

# Prune dev dependencies to reduce final image size
RUN npm prune --production || true

# ---------- Runtime stage ----------
FROM node:20-slim
WORKDIR /app

# Copy production node modules and built dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create data dir for sqlite and install wget for healthcheck
RUN mkdir -p /app/data \
    && apt-get update \
    && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=4000 \
    JWT_SECRET=change-me \
    CORS_ORIGIN=http://localhost:3000 \
    DB_PATH=/app/data/todoless.db

EXPOSE 4000
CMD ["node", "dist/index.js"]
