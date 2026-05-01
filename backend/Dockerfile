FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build

# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/src/migrations/*.sql ./dist/migrations/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3001

CMD ["node", "dist/server.js"]
