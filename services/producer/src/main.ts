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
    .setTitle('Producer Service')
    .setDescription('REST API для публикации событий в RabbitMQ')
    .setVersion('1.0.0')
    .addTag('events')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PRODUCER_HTTP_PORT ?? '3000', 10);
  await app.listen(port);
  Logger.log(`Producer service listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs available at http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
