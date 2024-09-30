FROM node:20

WORKDIR /usr/src/app

# COPY client/ ./
# COPY shared ./shared
COPY client/package*.json ./
RUN npm install --include=dev

EXPOSE 8080
CMD ["npm", "run", "start"]
