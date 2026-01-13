# Build stage
FROM node:18-alpine AS builder

# Install TypeScript globally
RUN npm install -g typescript

# Set working directory
WORKDIR /app

# Copy package files for both server and client
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN cd server && npm install
RUN cd client && npm install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Build TypeScript for server
RUN cd server && tsc

# Build client with webpack
RUN cd client && tsc && npx webpack

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy built server files and node_modules
COPY --from=builder /app/server/*.js ./server/
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy built client files
COPY --from=builder /app/client/index.html ./client/index.html
COPY --from=builder /app/client/style.css ./client/style.css
COPY --from=builder /app/client/app.js ./client/app.js

# Create directories for persistent data (will be mounted as volumes)
RUN mkdir -p /app/data /app/favicons

# Set working directory to server
WORKDIR /app/server

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "--insecure-http-parser", "server.js"]
