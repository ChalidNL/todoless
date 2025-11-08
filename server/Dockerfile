# Backend API for TodoLess
# Use Node 20 to ensure better-sqlite3 prebuilt binaries are available
FROM node:20-alpine

WORKDIR /app

# Install deps with caching (including devDependencies for build)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    else npm install; fi

# Copy source
COPY . .

# Build typescript
RUN npm run build

# Remove devDependencies after build
RUN if [ -f package-lock.json ]; then npm prune --production; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --production --frozen-lockfile --force; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --prod --frozen-lockfile; \
    else npm prune --production; fi

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Runtime vars (can be overridden by compose)
ENV JWT_SECRET=change-me \
    CORS_ORIGIN=http://localhost:3000 \
    DB_PATH=/app/data/todoless.db

# Create data dir for sqlite and install wget for healthcheck
RUN mkdir -p /app/data && \
    apk add --no-cache wget

CMD ["node", "dist/index.js"]
