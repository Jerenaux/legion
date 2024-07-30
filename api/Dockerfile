

FROM node:20

# Install Java
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk && \
    apt-get clean;

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY api/functions/package*.json ./

# Install dependencies
RUN npm install

RUN npm install -g firebase-tools

COPY api/functions/ .

CMD ["npm", "run", "docker:start"]
# CMD ["tail", "-f", "/dev/null"]
