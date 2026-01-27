FROM oven/bun:1.3.6

WORKDIR /usr/src/app

COPY server/package.json ./
COPY server/bun.lock ./

COPY server/nodemon.json ./
COPY server/nodemon.js ./

COPY server/*.env ./

RUN bun install

EXPOSE 3123

CMD ["bun", "run", "dev"]
