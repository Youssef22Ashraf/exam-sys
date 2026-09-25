# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/tsconfig.json ./
RUN npm ci
COPY backend/prisma ./prisma/
RUN npx prisma generate
COPY backend/src ./src/
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_URL="file:./dev.db"

# Install OpenSSL for Prisma runtime in Alpine
RUN apk add --no-cache openssl

# Install production-only dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma ./node_modules/@prisma

# Copy compiled backend code and prisma schema
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/prisma /app/backend/prisma.template

# Copy compiled frontend assets to /app/frontend/dist for backend static serving
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Ensure persistent uploads directory exists
RUN mkdir -p /app/backend/uploads/videos /app/backend/uploads/snapshots

EXPOSE 5000

# /api/health is unauthenticated and does no database work.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# If a Railway volume is mounted at /app/backend/prisma, it starts empty and shadows schema.prisma.
# Auto-populate schema.prisma from prisma.template into the mounted volume if missing, then push and start.
CMD ["sh", "-c", "if [ ! -f /app/backend/prisma/schema.prisma ]; then mkdir -p /app/backend/prisma && cp -r /app/backend/prisma.template/* /app/backend/prisma/ 2>/dev/null || true; fi; SCHEMA=/app/backend/prisma/schema.prisma; if [ ! -f \"$SCHEMA\" ]; then SCHEMA=/app/backend/prisma.template/schema.prisma; fi; npx prisma db push --schema=\"$SCHEMA\" && node dist/index.js"]


