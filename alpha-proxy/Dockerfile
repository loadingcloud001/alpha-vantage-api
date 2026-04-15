FROM node:22-alpine

WORKDIR /app

# No need to install Tor - it runs on the HOST, not in the container
# The container uses host network mode to reach Tor at 127.0.0.1:9050/9051

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Placeholder keys.json — REAL keys injected at runtime via volume mount
RUN echo '{"keys":[],"lastUpdated":"1970-01-01T00:00:00.000Z"}' > keys.json

EXPOSE 3000

# No Tor sidecar — Tor must be running on the HOST as a system service
# Container uses host network (--network=host) to reach host Tor
CMD ["node", "dist/index.js"]
