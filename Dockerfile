# ========================================
# Stage 1: Build Stage
# ========================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript server
RUN npm run build

# Build React client
RUN npm run build:client

# ========================================
# Stage 2: Production Stage
# ========================================
FROM node:20-alpine

# Install FFmpeg, yt-dlp and other runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    tzdata \
    curl \
    python3

# Download and install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set timezone to Asia/Tokyo
ENV TZ=Asia/Tokyo

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prompts.json ./prompts.json

# Copy index.html for serving frontend
COPY --from=builder /app/index.html ./index.html

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/healthz', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })" || exit 1

# Start application
CMD ["node", "dist/server.js"]
