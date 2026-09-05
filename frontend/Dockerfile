# Stage 1: Build Frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and configuration
COPY . .

# Build production bundle using Vite
RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine

# Copy compiled SPA assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
