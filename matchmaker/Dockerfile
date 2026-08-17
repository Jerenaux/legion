FROM oven/bun:1.3.14

WORKDIR /usr/src/app

COPY matchmaker/package.json ./
COPY matchmaker/bun.lock ./

# Copy config files (tsconfig, etc.)
COPY matchmaker/tsconfig*.json ./
COPY matchmaker/*.env ./

RUN bun install

EXPOSE 3000

# Use Bun's built-in watch mode instead of nodemon for better compatibility
CMD ["bun", "--watch", "--tsconfig-override", "tsconfig.docker.json", "src/matchmaker.ts"]
