# Multi-stage Dockerfile for Aura Sandbox Execution System
# Optimized for production deployment

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S aura -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm and production dependencies only
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder --chown=aura:nodejs /app/build ./build
COPY --from=builder --chown=aura:nodejs /app/static ./static

# Copy additional necessary files
COPY --chown=aura:nodejs .env.example ./
COPY --chown=aura:nodejs .env.sandbox-execution ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/tmp /app/uploads /app/cache
RUN chown -R aura:nodejs /app/logs /app/tmp /app/uploads /app/cache

# Set up log rotation and cleanup
RUN echo '#!/bin/sh\nfind /app/logs -name "*.log" -mtime +7 -delete' > /app/cleanup-logs.sh
RUN chmod +x /app/cleanup-logs.sh
RUN chown aura:nodejs /app/cleanup-logs.sh

# Switch to non-root user
USER aura

# Expose port
EXPOSE 3000

# Health check with comprehensive validation
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    let data = ''; \
    res.on('data', chunk => data += chunk); \
    res.on('end', () => { \
      try { \
        const health = JSON.parse(data); \
        process.exit(health.status === 'healthy' ? 0 : 1); \
      } catch(e) { \
        process.exit(1); \
      } \
    }); \
  }).on('error', () => process.exit(1))"

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]