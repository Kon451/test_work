import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule, MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { ROUTING } from '@app/contracts';
import { IdempotencyService } from './idempotency.service';
import { EventsConsumer } from './events.consumer';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
        connectionInitOptions: { wait: true, timeout: 30000 },
        // ручное управление ack/nack через @RabbitSubscribe
        defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        exchanges: [
          { name: ROUTING.EVENTS_EXCHANGE, type: 'topic', options: { durable: true } },
          { name: ROUTING.EVENTS_DLX, type: 'topic', options: { durable: true } },
        ],
        queues: [
          {
            name: ROUTING.CONSUMER_DLQ,
            exchange: ROUTING.EVENTS_DLX,
            routingKey: 'consumer.dead',
            createQueueIfNotExists: true,
            options: { durable: true },
          },
        ],
      }),
    }),
  ],
  providers: [IdempotencyService, EventsConsumer],
})
export class MessagingModule {}
