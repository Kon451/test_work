# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY services/consumer/package.json ./services/consumer/

RUN npm install --workspaces --include-workspace-root

COPY packages/contracts ./packages/contracts
COPY services/consumer ./services/consumer

RUN npm run build -w @app/contracts
RUN npm run build -w @app/consumer

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json /workspace/package-lock.json* ./
COPY --from=builder /workspace/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /workspace/services/consumer/package.json ./services/consumer/
COPY --from=builder /workspace/services/consumer/dist ./services/consumer/dist

RUN npm install --omit=dev --workspaces --include-workspace-root

WORKDIR /app/services/consumer
EXPOSE 3001
CMD ["node", "dist/main.js"]
