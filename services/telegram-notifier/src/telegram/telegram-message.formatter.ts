import { Injectable } from '@nestjs/common';
import {
  NotificationEvent,
  NotificationSeverity,
} from '@app/contracts';

@Injectable()
export class TelegramMessageFormatter {
  format(event: NotificationEvent): string {
    const icon = this.iconFor(event.payload.severity);
    const occurred = new Date(event.occurredAt).toISOString();
    const lines = [
      `${icon} <b>${this.escape(event.payload.title)}</b>`,
      '',
      this.escape(event.payload.message),
      '',
      `<i>severity:</i> ${event.payload.severity}`,
      `<i>source:</i> ${this.escape(event.source)}`,
      `<i>event id:</i> <code>${this.escape(event.eventId)}</code>`,
      `<i>occurred:</i> ${this.escape(occurred)}`,
    ];

    if (event.payload.metadata && Object.keys(event.payload.metadata).length > 0) {
      lines.push('', '<i>metadata:</i>');
      for (const [k, v] of Object.entries(event.payload.metadata)) {
        lines.push(`• ${this.escape(k)}: <code>${this.escape(String(v))}</code>`);
      }
    }
    return lines.join('\n');
  }

  private iconFor(severity: NotificationSeverity): string {
    switch (severity) {
      case NotificationSeverity.ERROR:
        return '[ERROR]';
      case NotificationSeverity.WARNING:
        return '[WARN]';
      default:
        return '[INFO]';
    }
  }

  private escape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
