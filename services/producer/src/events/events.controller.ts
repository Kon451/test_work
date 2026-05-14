import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventPublishedDto } from './dto/event-published.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Опубликовать событие в RabbitMQ',
    description:
      'Создаёт событие с уникальным UUID и публикует его в exchange. Возвращает 202 Accepted после подтверждения брокером.',
  })
  @ApiResponse({ status: 202, type: EventPublishedDto })
  async publish(@Body() dto: CreateEventDto): Promise<EventPublishedDto> {
    const event = await this.events.createAndPublish(dto);
    return {
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      status: 'queued',
    };
  }
}
