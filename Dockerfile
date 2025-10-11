# Use official Node.js 20 slim image
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY yarn.lock* ./
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 build-essential && rm -rf /var/lib/apt/lists/*

# Install deps (prefer npm; if yarn.lock exists, npm will still work)
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

## Production image
FROM node:20-slim
WORKDIR /app

# Minimal runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy built artifact and node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Use environment variable PORT if set
ENV PORT 3000

CMD ["npm", "start"]
