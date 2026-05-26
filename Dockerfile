FROM node:20-alpine AS base
WORKDIR /app

# Server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Client build
FROM node:20-alpine AS client-build
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
RUN cd client && npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S timecraft && adduser -S timecraft -u 1001
RUN mkdir -p /app/logs && chown -R timecraft:timecraft /app

COPY --from=base /app/server/node_modules ./server/node_modules
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist

RUN chown -R timecraft:timecraft /app

USER timecraft

EXPOSE 5001
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

CMD ["node", "server/server.js"]
