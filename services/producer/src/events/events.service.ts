import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NotificationEvent } from '@app/contracts';
import { RabbitPublisherService } from '../messaging/rabbit-publisher.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly source = 'producer-service';

  constructor(private readonly publisher: RabbitPublisherService) {}

  async createAndPublish(dto: CreateEventDto): Promise<NotificationEvent> {
    const event: NotificationEvent = {
      eventId: uuidv4(),
      occurredAt: new Date().toISOString(),
      source: this.source,
      payload: {
        title: dto.title,
        message: dto.message,
        severity: dto.severity,
        metadata: dto.metadata,
      },
    };

    await this.publisher.publishNotification(event);
    this.logger.log(`Event ${event.eventId} successfully queued`);
    return event;
  }
}
