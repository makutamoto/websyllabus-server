FROM node:12

WORKDIR /usr/src/app/
COPY package*.json ./
RUN npm install
COPY ./dist ./dist
COPY ./build ./build

EXPOSE 80
CMD ["node", "./dist/index.js"]
