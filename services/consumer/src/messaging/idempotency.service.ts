import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly seen = new Map<string, number>();
  private readonly ttlMs = 10 * 60 * 1000;

  constructor() {
    setInterval(() => this.evict(), 60 * 1000).unref();
  }

  /**
   * Returns true if this is the first time we see the id (claim succeeded).
   * Returns false if the id was already processed within TTL window.
   */
  claim(id: string): boolean {
    const now = Date.now();
    const previous = this.seen.get(id);
    if (previous !== undefined && now - previous < this.ttlMs) {
      this.logger.warn(`Duplicate event detected: ${id}`);
      return false;
    }
    this.seen.set(id, now);
    return true;
  }

  release(id: string): void {
    // Если обработка провалилась — отпускаем claim, чтобы ретрай мог пройти
    this.seen.delete(id);
  }

  private evict(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(id);
    }
  }
}
