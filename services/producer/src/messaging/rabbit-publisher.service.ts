import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  MESSAGE_HEADERS,
  NotificationEvent,
  ROUTING,
} from '@app/contracts';

@Injectable()
export class RabbitPublisherService {
  private readonly logger = new Logger(RabbitPublisherService.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async publishNotification(event: NotificationEvent): Promise<void> {
    await this.publishWithRetry(event, 3);
  }

  private async publishWithRetry(
    event: NotificationEvent,
    attempts: number,
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // publish() в @golevelup/nestjs-rabbitmq использует publisher confirms внутри
        // amqp-connection-manager — резолвится только после ack от брокера
        const ok = await this.amqp.publish(
          ROUTING.EVENTS_EXCHANGE,
          ROUTING.EVENT_CREATED_ROUTING_KEY,
          event,
          {
            persistent: true,
            messageId: event.eventId,
            timestamp: Date.now(),
            contentType: 'application/json',
            headers: {
              [MESSAGE_HEADERS.EVENT_ID]: event.eventId,
            },
          },
        );

        if (!ok) {
          throw new Error('Broker did not confirm the publish');
        }

        this.logger.log(
          `Published event ${event.eventId} (attempt ${attempt}/${attempts})`,
        );
        return;
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Publish attempt ${attempt}/${attempts} failed for event ${event.eventId}: ${message}`,
        );
        if (attempt < attempts) {
          await this.delay(this.computeBackoffMs(attempt));
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to publish event ${event.eventId}`);
  }

  private computeBackoffMs(attempt: number): number {
    // exponential backoff: 200ms, 400ms, 800ms...
    return 200 * 2 ** (attempt - 1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
