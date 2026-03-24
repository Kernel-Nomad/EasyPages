FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js .
COPY src ./src

COPY --from=build /app/dist ./dist

ENV PORT=8002
EXPOSE 8002

CMD ["npm", "start"]
