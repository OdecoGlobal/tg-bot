FROM node:24-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm ci 

COPY prisma ./prisma/

RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# RUN npm prune --production

EXPOSE 7000

CMD [ "node", "dist/server.js" ]