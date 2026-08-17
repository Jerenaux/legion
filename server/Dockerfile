FROM oven/bun:1.3.14

WORKDIR /usr/src/app

COPY server/package.json ./
COPY server/bun.lock ./

# Copy config files (tsconfig, etc.)
COPY server/tsconfig*.json ./
COPY server/*.env ./

RUN bun install

EXPOSE 3123

# Use Bun's built-in watch mode instead of nodemon for better compatibility
# Use tsconfig.docker.json for path aliases
CMD ["bun", "--watch", "--tsconfig-override", "tsconfig.docker.json", "src/server.ts"]
