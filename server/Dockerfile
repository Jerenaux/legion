FROM oven/bun:1.3.14

WORKDIR /usr/src/app

# Copy root package.json and lockfile
COPY package.json bun.lock ./
# Copy all package.json to their correct directory paths
COPY api/functions/package.json ./api/functions/
COPY client/package.json ./client/
COPY matchmaker/package.json ./matchmaker/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Copy config files (tsconfig, etc.)
COPY server/tsconfig*.json ./
COPY server/*.env ./

# Install dependencies
RUN bun ci --filter "./server"

EXPOSE 3123

# Use tsconfig.docker.json for path aliases
CMD ["bun", "--watch", "--tsconfig-override", "tsconfig.docker.json", "src/server.ts"]
