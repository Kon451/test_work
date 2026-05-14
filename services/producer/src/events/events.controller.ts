import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationSeverity } from '@app/contracts';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventPublishedDto } from './dto/event-published.dto';
import {
  ServerErrorDto,
  ValidationErrorDto,
} from './dto/error-response.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Опубликовать событие в RabbitMQ',
    description: [
      'Принимает событие, присваивает уникальный UUID и публикует в `events.exchange` ' +
        'с routing key `event.created`.',
      '',
      '**Гарантии:**',
      '- Идемпотентность — каждое событие получает UUID v4',
      '- Publisher confirms — ответ 202 возвращается только после подтверждения брокером',
      '- Retry — 3 попытки публикации с exponential backoff (200ms → 400ms → 800ms) ' +
        'при временных ошибках соединения',
      '',
      'Событие потом будет обработано двумя независимыми consumer-ами:',
      '`consumer.queue` (бизнес-обработка) и `telegram.queue` (отправка в Telegram).',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateEventDto,
    examples: {
      info: {
        summary: 'Информационное событие',
        value: {
          title: 'Order #42 created',
          message: 'Пользователь оформил заказ на сумму 1500 руб.',
          severity: NotificationSeverity.INFO,
          metadata: { orderId: 42, userId: 'u-001' },
        },
      },
      warning: {
        summary: 'Предупреждение',
        value: {
          title: 'Low stock warning',
          message: 'На складе осталось менее 10 единиц товара SKU-123',
          severity: NotificationSeverity.WARNING,
          metadata: { sku: 'SKU-123', remaining: 7 },
        },
      },
      error: {
        summary: 'Критическая ошибка',
        value: {
          title: 'Payment processing failed',
          message: 'Платёжный шлюз не отвечает более 30 секунд',
          severity: NotificationSeverity.ERROR,
          metadata: { gateway: 'stripe', orderId: 99 },
        },
      },
      minimal: {
        summary: 'Минимально валидное событие',
        value: {
          title: 'Hello',
          message: 'World',
          severity: NotificationSeverity.INFO,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Событие принято брокером и поставлено в очередь.',
    type: EventPublishedDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Невалидное тело запроса (DTO не прошёл валидацию).',
    type: ValidationErrorDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'Не удалось опубликовать событие после всех попыток ретрая ' +
      '(брокер недоступен или сетевой сбой).',
    type: ServerErrorDto,
  })
  async publish(@Body() dto: CreateEventDto): Promise<EventPublishedDto> {
    const event = await this.events.createAndPublish(dto);
    return {
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      status: 'queued',
    };
  }
}
