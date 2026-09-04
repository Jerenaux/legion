ARG BUN_VERSION=must-be-set
FROM oven/bun:${BUN_VERSION}

WORKDIR /usr/src/app

COPY matchmaker/package.json ./
COPY matchmaker/bun.lock ./

# Copy config files (tsconfig, etc.)
COPY matchmaker/tsconfig*.json ./

RUN bun install

EXPOSE 3000

# Use Bun's built-in watch mode instead of nodemon for better compatibility
CMD ["bun", "--watch", "--tsconfig-override", "tsconfig.docker.json", "src/matchmaker.ts"]
