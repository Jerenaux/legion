FROM node:20

WORKDIR /usr/src/app

COPY matchmaker/package*.json ./

RUN npm install

COPY shared/ ./ 

CMD ["npm", "run", "dev"]
# CMD ["tail", "-f", "/dev/null"]
