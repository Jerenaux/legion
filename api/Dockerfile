FROM oven/bun:1.3.14 AS builder

WORKDIR /usr/src/app

# Copy root package.json and lockfile
COPY package.json bun.lock ./
# Copy all package.json to their correct directory paths
COPY api/functions/package.json ./api/functions/
COPY client/package.json ./client/
COPY matchmaker/package.json ./matchmaker/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install dependencies
RUN bun ci --ignore-scripts --filter "./api/functions"

# Copy source to correct path
COPY api/functions/ ./api/functions/

# Install Node, required for firebase emulators
FROM node:20-slim

# Install Java, required for firebase emulators
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    openjdk-17-jdk && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/api/functions ./

COPY .firebaserc ./

RUN npm install -g firebase-tools

CMD ["npm", "run", "docker:start"]
