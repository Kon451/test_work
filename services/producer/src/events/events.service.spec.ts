import { EventsService } from './events.service';
import { NotificationSeverity } from '@app/contracts';

describe('EventsService', () => {
  it('creates event with UUID and publishes', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const service = new EventsService({ publishNotification: publish } as never);

    const event = await service.createAndPublish({
      title: 't',
      message: 'm',
      severity: NotificationSeverity.WARNING,
    });

    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.source).toBe('producer-service');
    expect(event.payload.severity).toBe(NotificationSeverity.WARNING);
    expect(publish).toHaveBeenCalledWith(event);
  });

  it('propagates publisher errors', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('broker down'));
    const service = new EventsService({ publishNotification: publish } as never);
    await expect(
      service.createAndPublish({
        title: 't',
        message: 'm',
        severity: NotificationSeverity.ERROR,
      }),
    ).rejects.toThrow('broker down');
  });
});
