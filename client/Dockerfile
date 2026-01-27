FROM oven/bun:1.3.6

WORKDIR /usr/src/app

COPY client/package.json ./
COPY client/bun.lock ./

# Use --ignore-scripts to skip native compilation of optional packages (bufferutil, utf-8-validate)
RUN bun install --ignore-scripts

COPY client/electron.js ./
COPY client/preload.js ./

COPY client/*.env ./

COPY client/.babelrc ./

WORKDIR /usr/src/app

EXPOSE 8080

CMD ["bun", "run", "start"]
