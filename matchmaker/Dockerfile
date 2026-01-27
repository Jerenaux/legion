FROM oven/bun:1.3.6

WORKDIR /usr/src/app

COPY matchmaker/package.json ./
COPY matchmaker/bun.lock ./

COPY server/nodemon.json ./
COPY server/nodemon.js ./

COPY server/*.env ./

RUN bun ci

COPY shared/ ./

CMD ["bun", "run", "dev"]
