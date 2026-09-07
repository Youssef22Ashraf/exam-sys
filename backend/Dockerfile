# Stage 1: Build & Generate Prisma Client
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and build TypeScript
COPY src ./src/
RUN npm run build

# Stage 2: Production Lightweight Image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_URL="file:./dev.db"

# Install openssl for Prisma runtime in alpine
RUN apk add --no-cache openssl

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled JavaScript code and Prisma schema/seed files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create upload directories for persistent storage
RUN mkdir -p /app/uploads/videos /app/uploads/snapshots

EXPOSE 5000

# Entrypoint: sync schema if needed and launch server
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
