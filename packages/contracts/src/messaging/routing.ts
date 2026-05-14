export const ROUTING = {
  EVENTS_EXCHANGE: 'events.exchange',
  EVENTS_DLX: 'events.dlx',
  CONSUMER_QUEUE: 'consumer.queue',
  TELEGRAM_QUEUE: 'telegram.queue',
  CONSUMER_DLQ: 'consumer.queue.dlq',
  TELEGRAM_DLQ: 'telegram.queue.dlq',
  EVENT_CREATED_ROUTING_KEY: 'event.created',
} as const;

export const MESSAGE_HEADERS = {
  RETRY_COUNT: 'x-retry-count',
  EVENT_ID: 'x-event-id',
} as const;
