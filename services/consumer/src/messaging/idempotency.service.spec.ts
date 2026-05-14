import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  it('claims a new id once and rejects duplicates', () => {
    const svc = new IdempotencyService();
    expect(svc.claim('event-1')).toBe(true);
    expect(svc.claim('event-1')).toBe(false);
    expect(svc.claim('event-2')).toBe(true);
  });

  it('release allows re-claiming', () => {
    const svc = new IdempotencyService();
    svc.claim('event-1');
    svc.release('event-1');
    expect(svc.claim('event-1')).toBe(true);
  });
});
