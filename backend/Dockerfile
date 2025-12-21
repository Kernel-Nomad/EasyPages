FROM node:18-alpine as frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

FROM node:18-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/server.js .

COPY backend/login.html .

COPY --from=frontend-build /app/frontend/dist ./dist

ENV PORT=8002
EXPOSE 8002

CMD ["npm", "start"]
