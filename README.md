# RabbitMQ + Telegram Microservices (Nest.js)

Микросервисное приложение на **NestJS** с обменом сообщениями через **RabbitMQ** и доставкой уведомлений в **Telegram** через Bot API.

## Архитектура

```
        ┌──────────────┐    POST /events    ┌────────────────────┐
   you ─▶│   Producer   │ ─────publish────▶ │                    │
        │ (REST + Swag.)│                   │      RabbitMQ      │
        └──────────────┘                    │  events.exchange   │
                                            │   (topic)          │
                                            └──┬──────────────┬──┘
                                               │              │
                                  consumer.queue        telegram.queue
                                       │                      │
                                       ▼                      ▼
                             ┌────────────────┐    ┌────────────────────┐
                             │   Consumer     │    │ Telegram Notifier  │
                             │ business logic │    │  → Bot API         │
                             └───────┬────────┘    └─────────┬──────────┘
                                     │ retry/DLQ              │ retry/DLQ
                                     ▼                        ▼
                             events.dlx (dead-letter exchange)
                             ├── consumer.queue.dlq
                             └── telegram.queue.dlq
```

* `events.exchange` — topic exchange, в который producer публикует события с routing key `event.created`.
* `consumer.queue` — бизнес-обработчик (логирует, может писать в БД и т.д.).
* `telegram.queue` — отправляет уведомление в Telegram.
* `events.dlx` — dead-letter exchange. Если сообщение не было обработано после `RABBITMQ_RETRY_LIMIT` попыток, оно уезжает в соответствующую `*.dlq`.

## Состав репозитория

```
.
├── docker-compose.yml          # RabbitMQ + 3 сервиса
├── .env.example                # переменные окружения
├── package.json                # npm workspaces корня
├── packages/
│   └── contracts/              # общие типы событий, константы очередей
└── services/
    ├── producer/               # REST → RabbitMQ (Swagger на /docs)
    ├── consumer/               # обработчик с retry / DLQ / idempotency
    └── telegram-notifier/      # отправка в Telegram Bot API
```

## Требования

* Node.js ≥ 20
* Docker + Docker Compose v2
* Telegram Bot Token + Chat ID (получаются за минуту, см. ниже)

## Подготовка Telegram

1. В Telegram открой `@BotFather` → `/newbot` → задай имя → скопируй токен вида `123456789:ABCdefGhIJKlmNoPQRstuVWXyz`.
2. Узнай свой Chat ID: напиши боту `@userinfobot` — он пришлёт `Id`.
3. **Важно:** отправь своему боту хоть одно сообщение (любое), чтобы он мог тебе отвечать.

## Запуск через Docker (рекомендуемый путь)

```bash
cp .env.example .env
# Открой .env и впиши TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

docker compose up --build
```

После старта будут доступны:

| Что | Адрес |
| --- | --- |
| Producer REST API | http://localhost:3000 |
| Producer Swagger | http://localhost:3000/docs |
| Consumer healthcheck | http://localhost:3001/health |
| Telegram notifier healthcheck | http://localhost:3002/health |
| RabbitMQ management UI | http://localhost:15672 (guest / guest) |

### Отправить тестовое событие

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Order #42 created",
    "message": "Пользователь оформил заказ на сумму 1500 руб.",
    "severity": "info",
    "metadata": { "orderId": 42, "userId": "u-001" }
  }'
```

Ответ:
```json
{
  "eventId": "b3f5e1ac-1c4b-4b9c-9e0a-9b9b9b9b9b9b",
  "occurredAt": "2026-05-14T10:00:00.000Z",
  "status": "queued"
}
```

В Telegram придёт форматированное сообщение, а в логах consumer/telegram-notifier увидишь обработку.

## Запуск без Docker (только Node)

Понадобится локально запущенный RabbitMQ (или из docker-compose только сервис rabbitmq):

```bash
docker compose up -d rabbitmq
cp .env.example .env  # пропиши Telegram токен и chat id
# В .env поменяй RABBITMQ_URL на amqp://guest:guest@localhost:5672

npm install
npm run build -w @app/contracts

# в трёх отдельных терминалах:
npm run start:producer
npm run start:consumer
npm run start:telegram
```

## Тестирование

```bash
# Все unit-тесты (jest) во всех сервисах:
npm test --workspaces --if-present

# E2E-тест producer (HTTP + валидация DTO):
npx --prefix services/producer jest --config services/producer/test/jest-e2e.json
```

Покрытие:
- `services/producer/src/events/events.service.spec.ts` — UUID, публикация, проброс ошибок
- `services/producer/test/events.e2e-spec.ts` — POST /events: 202, 400
- `services/consumer/src/messaging/idempotency.service.spec.ts` — TTL-claim
- `services/telegram-notifier/src/telegram/telegram-message.formatter.spec.ts` — форматирование HTML и экранирование

## Архитектурные решения

### Идемпотентность
Producer присваивает каждому событию UUID (v4) и публикует с `messageId = eventId`. На стороне обоих consumer'ов есть in-memory `IdempotencyService` со скользящим окном (10 минут), который отбрасывает дубликаты. Для продакшена этот сервис заменяется на Redis/PostgreSQL (см. интерфейс — заменить реализацию).

### Подтверждение публикации
`@golevelup/nestjs-rabbitmq` использует `amqp-connection-manager` с включёнными publisher confirms — `publish()` резолвится только после ack от брокера. Поверх этого producer делает до 3 попыток с экспоненциальным backoff (200ms → 400ms → 800ms).

### Retry на стороне consumer
* Ручной ack/nack через возвращаемое значение из `@RabbitSubscribe`-обработчика.
* При ошибке читается заголовок `x-retry-count`, если он меньше `RABBITMQ_RETRY_LIMIT` — событие переотправляется в exchange с увеличенным счётчиком и backoff.
* Если попытки исчерпаны — `Nack(false)` отправляет сообщение в `events.dlx` → `consumer.queue.dlq` (или `telegram.queue.dlq`).
* Невалидный JSON (не проходит `isNotificationEvent`) сразу едет в DLQ.

### SOLID / Clean Architecture
* Каждый сервис разбит на модули (`messaging/`, `events/`, `telegram/`) — единая ответственность.
* `RabbitPublisherService` инкапсулирует транспорт, `EventsService` — бизнес-логику, контроллер — только HTTP.
* Контракты вынесены в отдельный workspace-пакет `@app/contracts`, оба consumer'a зависят от интерфейса, а не от реализации.
* Telegram-формат сообщения — отдельный класс `TelegramMessageFormatter`, протестирован изолированно.

### Swagger
Producer экспонирует OpenAPI на `/docs` (Swagger UI). DTO документируются через `@ApiProperty`, что даёт схему запроса и валидацию ввода через `class-validator`.

## Переменные окружения

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672` | Подключение к брокеру |
| `RABBITMQ_RETRY_LIMIT` | `3` | Максимум ретраев перед DLQ |
| `PRODUCER_HTTP_PORT` | `3000` | HTTP-порт producer |
| `CONSUMER_HTTP_PORT` | `3001` | HTTP-порт consumer |
| `TELEGRAM_HTTP_PORT` | `3002` | HTTP-порт telegram-notifier |
| `TELEGRAM_BOT_TOKEN` | — | Токен бота из @BotFather |
| `TELEGRAM_CHAT_ID` | — | Куда слать уведомления |

## Возможные улучшения

* Заменить in-memory `IdempotencyService` на Redis (для горизонтального масштабирования consumer'ов).
* Делать retry через `delayed-message-exchange` plugin вместо ручного backoff — это снимет блокировку обработчика.
* Добавить Prometheus-метрики (через `@willsoto/nestjs-prometheus`).
* Авторизация на endpoint `/events` (например, X-API-Key).
* Поддержка нескольких типов событий с разными routing key и схемами.
