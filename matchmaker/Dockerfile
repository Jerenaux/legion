FROM oven/bun:1.3.8

WORKDIR /usr/src/app

# Copy root package.json and lockfile
COPY package.json bun.lock ./
# Copy all package.json to their correct directory paths
COPY api/functions/package.json ./api/functions/
COPY client/package.json ./client/
COPY matchmaker/package.json ./matchmaker/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Copy config files to correct path
COPY matchmaker/tsconfig*.json ./matchmaker/
COPY matchmaker/*.env ./matchmaker/

# Install dependencies
RUN bun ci --filter "./matchmaker"

WORKDIR /usr/src/app/matchmaker

EXPOSE 3000

CMD ["bun", "--watch", "--tsconfig-override", "tsconfig.docker.json", "src/matchmaker.ts"]
