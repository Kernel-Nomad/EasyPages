# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY server.js .
COPY src ./src

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8002
EXPOSE 8002

CMD ["npm", "start"]
