# Build stage
FROM node:18-bullseye AS builder

# Install TypeScript globally
RUN npm install -g typescript

# Set working directory
WORKDIR /app

# Copy package files for server, client, and login
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY login/package*.json ./login/

# Install dependencies
RUN cd server && npm install
RUN cd client && npm install
RUN cd login && npm install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/
COPY login/ ./login/

# Build TypeScript for server
RUN cd server && tsc

# Build TypeScript for login server
RUN cd login && tsc

# Build client with webpack
RUN cd client && tsc && npx webpack

# Runtime stage
FROM node:18-bullseye

WORKDIR /app

# Copy built server files and node_modules
COPY --from=builder /app/server/*.js ./server/
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy built login server files and node_modules
COPY --from=builder /app/login/login-server.js ./login/
COPY --from=builder /app/login/login.html ./login/
COPY --from=builder /app/login/package*.json ./login/
COPY --from=builder /app/login/node_modules ./login/node_modules

# Copy built client files
COPY --from=builder /app/client/index.html ./client/index.html
COPY --from=builder /app/client/style.css ./client/style.css
COPY --from=builder /app/client/app.js ./client/app.js

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Create directories for persistent data (will be mounted as volumes)
RUN mkdir -p /app/data /app/favicons

# Expose ports for both servers
EXPOSE 3000 3001

# Start both applications
CMD ["./start.sh"]
