# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.2.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ui/package.json ./ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build UI
RUN pnpm --filter ./ui run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/ui/dist /usr/share/nginx/html

# Copy nginx config
COPY ui/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
