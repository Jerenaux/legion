FROM node:20

WORKDIR /usr/src/app

COPY server/package*.json ./

RUN npm install

EXPOSE 3123
CMD ["npm", "run", "dev"]
