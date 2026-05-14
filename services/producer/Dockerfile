# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS builder
WORKDIR /workspace

# Установка зависимостей через workspaces
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY services/producer/package.json ./services/producer/

RUN npm install --workspaces --include-workspace-root

# Копируем исходники и билдим
COPY packages/contracts ./packages/contracts
COPY services/producer ./services/producer

RUN npm run build -w @app/contracts
RUN npm run build -w @app/producer

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json /workspace/package-lock.json* ./
COPY --from=builder /workspace/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /workspace/services/producer/package.json ./services/producer/
COPY --from=builder /workspace/services/producer/dist ./services/producer/dist

RUN npm install --omit=dev --workspaces --include-workspace-root

WORKDIR /app/services/producer
EXPOSE 3000
CMD ["node", "dist/main.js"]
