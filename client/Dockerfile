FROM oven/bun:1.3.14

WORKDIR /usr/src/app

COPY client/package.json ./
COPY client/bun.lock ./

# Use --ignore-scripts to skip native compilation of optional packages (bufferutil, utf-8-validate)
RUN bun install --ignore-scripts

# Copy all config files (webpack, tsconfig, etc.)
COPY client/*.json ./
COPY client/*.js ./
COPY client/*.env ./
COPY client/.babelrc ./

EXPOSE 8080

CMD ["bun", "run", "start"]
