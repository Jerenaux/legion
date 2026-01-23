FROM oven/bun:1.3.6

WORKDIR /usr/src/app

COPY api/functions/package.json ./
COPY api/functions/bun.lock ./

RUN bun ci

COPY api/functions/ ./

COPY .firebaserc ./

RUN bun add -g firebase-tools

CMD ["bun", "run", "docker:start"]
