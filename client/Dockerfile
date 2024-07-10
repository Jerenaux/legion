FROM node:20

WORKDIR /usr/src/app

COPY client/ ./
COPY shared ./shared
RUN npm install


EXPOSE 8080
CMD ["npm", "run", "start"]
