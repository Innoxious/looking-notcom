FROM node:current-alpine3.17 as base

WORKDIR /app

COPY package.json package-lock.json ./

RUN rm -rf node_modules && npm ci

COPY . .

CMD node --env-file=.env ./api.js