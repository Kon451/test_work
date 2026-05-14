import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { EventsController } from '../src/events/events.controller';
import { EventsService } from '../src/events/events.service';
import { RabbitPublisherService } from '../src/messaging/rabbit-publisher.service';
import { NotificationSeverity } from '@app/contracts';

describe('Events (e2e)', () => {
  let app: INestApplication;
  const publisherMock = { publishNotification: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    // Собираем тестовый модуль БЕЗ MessagingModule, чтобы не подниматься к RabbitMQ.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        EventsService,
        { provide: RabbitPublisherService, useValue: publisherMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /events publishes event and returns 202', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Hello',
        message: 'World',
        severity: NotificationSeverity.INFO,
      })
      .expect(202);

    expect(res.body.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.status).toBe('queued');
    expect(publisherMock.publishNotification).toHaveBeenCalledTimes(1);
    const event = publisherMock.publishNotification.mock.calls.at(-1)?.[0];
    expect(event.payload.title).toBe('Hello');
    expect(event.source).toBe('producer-service');
  });

  it('POST /events rejects invalid payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({ title: 'no severity', message: 'oops' })
      .expect(400);
  });
});
