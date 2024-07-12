# FROM node:20

# WORKDIR /usr/src/app

# COPY package*.json ./
# RUN npm install

# COPY . .

# EXPOSE 3123
# CMD ["npm", "run", "start"]

FROM node:20

WORKDIR /usr/src/app

COPY server/ ./
COPY shared ./shared
RUN npm install


EXPOSE 3123
CMD ["npm", "run", "start"]
