export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface NotificationEventPayload {
  title: string;
  message: string;
  severity: NotificationSeverity;
  metadata?: Record<string, string | number | boolean>;
}

export interface NotificationEvent {
  eventId: string;
  occurredAt: string;
  source: string;
  payload: NotificationEventPayload;
}

export const isNotificationEvent = (value: unknown): value is NotificationEvent => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NotificationEvent>;
  return (
    typeof candidate.eventId === 'string' &&
    typeof candidate.occurredAt === 'string' &&
    typeof candidate.source === 'string' &&
    !!candidate.payload &&
    typeof candidate.payload.title === 'string' &&
    typeof candidate.payload.message === 'string' &&
    typeof candidate.payload.severity === 'string'
  );
};
