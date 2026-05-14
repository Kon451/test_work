import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramMessageFormatter } from './telegram-message.formatter';

@Module({
  providers: [TelegramService, TelegramMessageFormatter],
  exports: [TelegramService],
})
export class TelegramModule {}
