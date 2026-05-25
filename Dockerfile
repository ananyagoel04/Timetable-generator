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
COPY --from=base /app/server/node_modules ./server/node_modules
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 5001
ENV NODE_ENV=production
CMD ["node", "server/server.js"]
