import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationEvent } from '@app/contracts';
import { TelegramMessageFormatter } from './telegram-message.formatter';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private botToken!: string;
  private chatId!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly formatter: TelegramMessageFormatter,
  ) {}

  onModuleInit(): void {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!this.botToken || this.botToken.startsWith('replace_with')) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not configured — notifications will fail. Set it in .env',
      );
    }
    if (!this.chatId || this.chatId.startsWith('replace_with')) {
      this.logger.warn(
        'TELEGRAM_CHAT_ID is not configured — notifications will fail. Set it in .env',
      );
    }
  }

  async sendNotification(event: NotificationEvent): Promise<void> {
    if (!this.botToken || !this.chatId) {
      throw new Error('Telegram bot is not configured (token or chat id missing)');
    }

    const text = this.formatter.format(event);
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const body = {
      chat_id: this.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Telegram API returned ${response.status}: ${errorBody.slice(0, 300)}`,
      );
    }

    this.logger.log(`Notification for event ${event.eventId} delivered to Telegram`);
  }
}
