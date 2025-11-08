# Multi-stage build for a static Vite + React app served by Nginx

# 1) Build stage
FROM node:20-alpine AS builder
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=${VITE_API_URL}
WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    else npm install; fi

# Copy source and build
# Copy only necessary sources (reduced context already via .dockerignore)
COPY . .
# Vite will inline VITE_* env vars available at build time
RUN echo "Building with VITE_API_URL=${VITE_API_URL}" && npm run build

# 2) Runtime stage
FROM nginx:1.27-alpine AS runtime
LABEL org.opencontainers.image.title="Todoless" \
      org.opencontainers.image.description="Todoless v3 static SPA built with Vite + React" \
    org.opencontainers.image.url="https://github.com/ChalidNL/todoless" \
      org.opencontainers.image.licenses="MIT"

# Install small curl for healthcheck
RUN apk add --no-cache curl

# Copy Nginx config and built assets
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Optional: basic healthcheck (nginx serves index.html)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
