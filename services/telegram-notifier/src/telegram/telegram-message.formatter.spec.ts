import { TelegramMessageFormatter } from './telegram-message.formatter';
import { NotificationSeverity } from '@app/contracts';

describe('TelegramMessageFormatter', () => {
  const formatter = new TelegramMessageFormatter();

  it('formats info event with metadata', () => {
    const text = formatter.format({
      eventId: 'abc-123',
      occurredAt: '2026-05-14T10:00:00.000Z',
      source: 'producer-service',
      payload: {
        title: 'Order created',
        message: 'User placed an order',
        severity: NotificationSeverity.INFO,
        metadata: { orderId: 42 },
      },
    });

    expect(text).toContain('[INFO]');
    expect(text).toContain('<b>Order created</b>');
    expect(text).toContain('orderId');
    expect(text).toContain('<code>abc-123</code>');
  });

  it('escapes HTML in title/message', () => {
    const text = formatter.format({
      eventId: '1',
      occurredAt: '2026-05-14T10:00:00.000Z',
      source: 's',
      payload: {
        title: '<script>',
        message: 'a & b',
        severity: NotificationSeverity.ERROR,
      },
    });
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('a &amp; b');
    expect(text).toContain('[ERROR]');
  });
});
