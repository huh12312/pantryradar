# Multi-stage build for Bun + Hono
FROM oven/bun:1-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files from root and server
COPY package.json ./
COPY server/package.json ./server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY server ./server
COPY packages/shared ./packages/shared

# Build the application
WORKDIR /app/server
RUN bun run build

# Production stage
FROM oven/bun:1-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/server/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/server/package.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3000/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["bun", "run", "dist/index.js"]
