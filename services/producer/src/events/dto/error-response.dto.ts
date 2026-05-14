import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    type: [String],
    example: [
      'title must be shorter than or equal to 200 characters',
      'severity must be one of the following values: info, warning, error',
    ],
  })
  message!: string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}

export class ServerErrorDto {
  @ApiProperty({ example: 500 })
  statusCode!: number;

  @ApiProperty({
    example: 'Broker did not confirm the publish',
    description: 'Возвращается если все попытки публикации в RabbitMQ исчерпаны',
  })
  message!: string;

  @ApiProperty({ example: 'Internal Server Error' })
  error!: string;
}
