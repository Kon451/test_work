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
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class TelegramConsumer {
  private readonly logger = new Logger(TelegramConsumer.name);
  private readonly maxRetries: number;
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly amqp: AmqpConnection,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {
    this.maxRetries = parseInt(this.config.get<string>('RABBITMQ_RETRY_LIMIT', '3'), 10);
    setInterval(() => this.evict(), 60 * 1000).unref();
  }

  @RabbitSubscribe({
    exchange: ROUTING.EVENTS_EXCHANGE,
    routingKey: ROUTING.EVENT_CREATED_ROUTING_KEY,
    queue: ROUTING.TELEGRAM_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': ROUTING.EVENTS_DLX,
        'x-dead-letter-routing-key': 'telegram.dead',
      },
    },
  })
  async handle(raw: unknown, amqpMsg: ConsumeMessage): Promise<Nack | void> {
    if (!isNotificationEvent(raw)) {
      this.logger.error('Rejecting malformed message');
      return new Nack(false);
    }

    const event = raw as NotificationEvent;
    const retryCount = this.readRetryCount(amqpMsg);

    if (!this.claim(event.eventId)) {
      this.logger.warn(`Skipping duplicate notification for ${event.eventId}`);
      return;
    }

    try {
      await this.telegram.sendNotification(event);
      this.logger.log(
        `Telegram notification sent for event ${event.eventId}`,
      );
      return;
    } catch (err) {
      this.seen.delete(event.eventId);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Telegram delivery failed for ${event.eventId} (retry ${retryCount}/${this.maxRetries}): ${message}`,
      );

      if (retryCount < this.maxRetries) {
        await this.scheduleRetry(event, retryCount + 1);
        return;
      }

      this.logger.error(
        `Event ${event.eventId} exhausted ${this.maxRetries} retries, sending to DLQ`,
      );
      return new Nack(false);
    }
  }

  private readRetryCount(msg: ConsumeMessage): number {
    const raw = msg.properties.headers?.[MESSAGE_HEADERS.RETRY_COUNT];
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '0'), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private claim(id: string): boolean {
    const now = Date.now();
    const previous = this.seen.get(id);
    if (previous !== undefined && now - previous < 10 * 60 * 1000) {
      return false;
    }
    this.seen.set(id, now);
    return true;
  }

  private evict(): void {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(id);
    }
  }

  private async scheduleRetry(
    event: NotificationEvent,
    nextRetry: number,
  ): Promise<void> {
    const backoffMs = 1000 * 2 ** (nextRetry - 1);
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
  }
}
