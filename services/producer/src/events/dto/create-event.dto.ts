import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NotificationSeverity } from '@app/contracts';

export class CreateEventDto {
  @ApiProperty({ example: 'Order #42 created', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example: 'Пользователь оформил заказ на сумму 1500₽',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ enum: NotificationSeverity, example: NotificationSeverity.INFO })
  @IsEnum(NotificationSeverity)
  severity!: NotificationSeverity;

  @ApiPropertyOptional({
    description: 'Произвольные ключ/значение для контекста события',
    example: { orderId: 42, userId: 'u-001' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}
