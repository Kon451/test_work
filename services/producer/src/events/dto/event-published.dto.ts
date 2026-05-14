import { ApiProperty } from '@nestjs/swagger';

export class EventPublishedDto {
  @ApiProperty({ example: 'b3f5e1ac-1c4b-4b9c-9e0a-9b9b9b9b9b9b' })
  eventId!: string;

  @ApiProperty({ example: '2026-05-14T10:00:00.000Z' })
  occurredAt!: string;

  @ApiProperty({ example: 'queued' })
  status!: 'queued';
}
