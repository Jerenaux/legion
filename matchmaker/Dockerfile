FROM node:20

WORKDIR /usr/src/app

COPY matchmaker/ ./
COPY shared ./shared
RUN npm install


EXPOSE 3000
CMD ["npm", "run", "start"]
    