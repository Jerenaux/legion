ARG BUN_VERSION=must-be-set
FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /usr/src/app

COPY api/functions/package.json ./
COPY api/functions/bun.lock ./

RUN bun ci --ignore-scripts

COPY api/functions/ ./


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
COPY --from=builder /usr/src/app ./

COPY .firebaserc ./

RUN npm install -g firebase-tools

CMD ["npm", "run", "docker:start"]
