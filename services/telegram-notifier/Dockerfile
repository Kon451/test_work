# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY services/telegram-notifier/package.json ./services/telegram-notifier/

RUN npm install --workspaces --include-workspace-root

COPY packages/contracts ./packages/contracts
COPY services/telegram-notifier ./services/telegram-notifier

RUN npm run build -w @app/contracts
RUN npm run build -w @app/telegram-notifier

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json /workspace/package-lock.json* ./
COPY --from=builder /workspace/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /workspace/services/telegram-notifier/package.json ./services/telegram-notifier/
COPY --from=builder /workspace/services/telegram-notifier/dist ./services/telegram-notifier/dist

RUN npm install --omit=dev --workspaces --include-workspace-root

WORKDIR /app/services/telegram-notifier
EXPOSE 3002
CMD ["node", "dist/main.js"]
