# start from Node image
# copy package.json and install deps
# copy source files
# build typescript to dist
# run node dist/main.js

FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
