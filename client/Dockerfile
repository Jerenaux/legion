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

# Install dependencies
RUN bun ci --ignore-scripts --filter "./client"

# Copy all config files
COPY client/*.json ./client/
COPY client/*.js ./client/
COPY client/*.env ./client/
COPY client/.babelrc ./client/

WORKDIR /usr/src/app/client

EXPOSE 8080

CMD ["bun", "run", "start"]
