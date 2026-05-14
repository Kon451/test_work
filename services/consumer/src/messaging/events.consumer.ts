import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnection,
  Nack,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';
import {
  isNotificationEvent,
  MESSAGE_HEADERS,
  NotificationEvent,
  ROUTING,
} from '@app/contracts';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class EventsConsumer {
  private readonly logger = new Logger(EventsConsumer.name);
  private readonly maxRetries: number;

  constructor(
    private readonly amqp: AmqpConnection,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
  ) {
    this.maxRetries = parseInt(this.config.get<string>('RABBITMQ_RETRY_LIMIT', '3'), 10);
  }

  @RabbitSubscribe({
    exchange: ROUTING.EVENTS_EXCHANGE,
    routingKey: ROUTING.EVENT_CREATED_ROUTING_KEY,
    queue: ROUTING.CONSUMER_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': ROUTING.EVENTS_DLX,
        'x-dead-letter-routing-key': 'consumer.dead',
      },
    },
  })
  async handle(raw: unknown, amqpMsg: ConsumeMessage): Promise<Nack | void> {
    if (!isNotificationEvent(raw)) {
      this.logger.error(
        `Rejecting malformed message: ${JSON.stringify(raw).slice(0, 200)}`,
      );
      return new Nack(false); // → DLQ
    }

    const event = raw as NotificationEvent;
    const retryCount = this.readRetryCount(amqpMsg);

    if (!this.idempotency.claim(event.eventId)) {
      this.logger.warn(
        `Skipping duplicate event ${event.eventId} (already processed)`,
      );
      return; // ack — дубликат проглатываем без повтора
    }

    try {
      await this.process(event);
      this.logger.log(
        `Event ${event.eventId} processed successfully (severity=${event.payload.severity})`,
      );
      return;
    } catch (err) {
      this.idempotency.release(event.eventId);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Processing failed for ${event.eventId} (retry ${retryCount}/${this.maxRetries}): ${message}`,
      );

      if (retryCount < this.maxRetries) {
        await this.scheduleRetry(event, retryCount + 1);
        return; // ack оригинала, мы переотправили копию
      }

      this.logger.error(
        `Event ${event.eventId} exhausted ${this.maxRetries} retries, sending to DLQ`,
      );
      return new Nack(false); // → DLQ через настроенный x-dead-letter-exchange
    }
  }

  private async process(event: NotificationEvent): Promise<void> {
    // Бизнес-обработка: здесь могла бы быть запись в БД, вызов внешнего API и т.д.
    // Для демо — просто логируем и считаем обработанным.
    this.logger.debug(
      `Processing event ${event.eventId}: "${event.payload.title}"`,
    );
  }

  private readRetryCount(msg: ConsumeMessage): number {
    const raw = msg.properties.headers?.[MESSAGE_HEADERS.RETRY_COUNT];
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '0'), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private async scheduleRetry(
    event: NotificationEvent,
    nextRetry: number,
  ): Promise<void> {
    const backoffMs = 500 * 2 ** (nextRetry - 1);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    await this.amqp.publish(
      ROUTING.EVENTS_EXCHANGE,
      ROUTING.EVENT_CREATED_ROUTING_KEY,
      event,
      {
        persistent: true,
        messageId: event.eventId,
        contentType: 'application/json',
        headers: {
          [MESSAGE_HEADERS.EVENT_ID]: event.eventId,
          [MESSAGE_HEADERS.RETRY_COUNT]: nextRetry,
        },
      },
    );
    this.logger.log(
      `Event ${event.eventId} re-queued for retry ${nextRetry}/${this.maxRetries}`,
    );
  }
}
