FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=backend-builder /app/dist ./dist
COPY src/migrations/*.sql ./dist/migrations/

EXPOSE 3001

CMD ["node", "dist/server.js"]
