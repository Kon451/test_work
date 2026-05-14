import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.TELEGRAM_HTTP_PORT ?? '3002', 10);
  await app.listen(port);
  Logger.log(`Telegram notifier listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
