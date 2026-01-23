FROM oven/bun:1.3.6

WORKDIR /usr/src/app

COPY api/functions/package.json ./
COPY api/functions/bun.lock ./

RUN bun ci

COPY api/functions/ ./

COPY .firebaserc ./

# Install Java, required for firebase emulators
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    openjdk-17-jdk && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN bun add -g firebase-tools

CMD ["bun", "run", "docker:start"]
