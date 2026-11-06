# Multi-stage Dockerfile for LinkSnip URL Shortener
# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy full project source
COPY . .

# Build client assets and Nitro standalone production server
RUN npm run build

# Stage 2: Runtime
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Create data directory for persistent SQLite storage
RUN mkdir -p /app/data && chown -R node:node /app/data

# Copy the built output from builder stage
COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/package.json /app/package.json

USER node

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", ".output/server/index.mjs"]

