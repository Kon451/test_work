import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Producer Service API')
    .setDescription(
      [
        'REST API для публикации событий в брокер сообщений RabbitMQ.',
        '',
        '## Архитектура',
        '',
        'Producer принимает HTTP-запрос → присваивает событию UUID → ' +
          'публикует в topic exchange `events.exchange` с routing key `event.created`.',
        '',
        'Дальше событие независимо обрабатывают два consumer-а:',
        '- **consumer-service** — бизнес-обработка (логирование, запись в БД)',
        '- **telegram-notifier** — отправка уведомления в Telegram через Bot API',
        '',
        '## Надёжность доставки',
        '',
        '- **Publisher confirms** — `POST /events` отвечает 202 только после ack от брокера',
        '- **Retry на producer** — до 3 попыток с exponential backoff при сбоях соединения',
        '- **Идемпотентность** — каждое событие имеет UUID, consumer\'ы дедуплицируют по нему',
        '- **DLQ** — после `RABBITMQ_RETRY_LIMIT` неудачных обработок событие уезжает в ' +
          '`events.dlx` (consumer.queue.dlq или telegram.queue.dlq)',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addTag('events', 'Публикация событий в брокер')
    .setContact(
      'GitHub',
      'https://github.com/Kon451/test_work',
      '',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 1,
    },
  });

  const port = parseInt(process.env.PRODUCER_HTTP_PORT ?? '3000', 10);
  await app.listen(port);
  Logger.log(`Producer service listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs available at http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
