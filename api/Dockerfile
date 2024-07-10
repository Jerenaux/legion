FROM node:20

# Install Java
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk && \
    apt-get clean;

WORKDIR /usr/src/app

COPY api/functions/ .
COPY shared ./shared
RUN npm install

EXPOSE 8080
CMD ["npm", "run", "serve"]
# CMD ["tail", "-f", "/dev/null"]
