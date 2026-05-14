import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule, MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { ROUTING } from '@app/contracts';
import { TelegramModule } from '../telegram/telegram.module';
import { TelegramConsumer } from './telegram.consumer';

@Module({
  imports: [
    TelegramModule,
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
        connectionInitOptions: { wait: true, timeout: 30000 },
        defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        exchanges: [
          { name: ROUTING.EVENTS_EXCHANGE, type: 'topic', options: { durable: true } },
          { name: ROUTING.EVENTS_DLX, type: 'topic', options: { durable: true } },
        ],
        queues: [
          {
            name: ROUTING.TELEGRAM_DLQ,
            exchange: ROUTING.EVENTS_DLX,
            routingKey: 'telegram.dead',
            createQueueIfNotExists: true,
            options: { durable: true },
          },
        ],
      }),
    }),
  ],
  providers: [TelegramConsumer],
})
export class MessagingModule {}
