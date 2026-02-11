FROM node:24-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm ci 

COPY . .

RUN rm -rf dist

RUN npx prisma generate

RUN npm run build

# RUN npm prune --production

EXPOSE 7000

CMD [ "node", "dist/server.js" ]