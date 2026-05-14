import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ROUTING } from '@app/contracts';
import { RabbitPublisherService } from './rabbit-publisher.service';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
        connectionInitOptions: { wait: true, timeout: 30000 },
        enableControllerDiscovery: false,
        // publisher confirms — гарантия доставки до брокера
        connectionManagerOptions: { heartbeatIntervalInSeconds: 15 },
        exchanges: [
          {
            name: ROUTING.EVENTS_EXCHANGE,
            type: 'topic',
            options: { durable: true },
          },
          {
            name: ROUTING.EVENTS_DLX,
            type: 'topic',
            options: { durable: true },
          },
        ],
        channels: {
          'producer-publisher': {
            default: true,
            prefetchCount: 1,
          },
        },
      }),
    }),
  ],
  providers: [RabbitPublisherService, Logger],
  exports: [RabbitPublisherService],
})
export class MessagingModule {}
