/** Semaphore for limiting concurrent execution of async operations. */
export class Semaphore {
  private current = 0;
  private waitQueue: Array<{ resolve: () => void }> = [];

  constructor(private maxConcurrency: number) {}

  /** Acquires a permit, waiting if the max concurrency has been reached. */
  async acquire(): Promise<void> {
    if (this.current < this.maxConcurrency) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push({ resolve });
    });
  }

  /** Releases a permit, allowing the next waiting operation to proceed. */
  release(): void {
    this.current--;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      this.current++;
      next.resolve();
    }
  }
}

/** Rate limiter for controlling request throughput over time. */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /** Wait until a request slot is available within the rate limit window. */
  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return;
    }
    const oldestInWindow = this.timestamps[0];
    const waitMs = this.windowMs - (now - oldestInWindow) + 1;
    await new Promise<void>(resolve => setTimeout(resolve, waitMs));
    this.timestamps.push(Date.now());
  }
}

/** Global rate limiter for backup operations: 60 requests per 60 seconds. */
export const backupRateLimiter = new RateLimiter(
  Number(process.env.BACKUP_RATE_LIMIT_MAX ?? '60'),
  Number(process.env.BACKUP_RATE_LIMIT_WINDOW_MS ?? '60000')
);

type SettledResult<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

/** Runs an async function over items with bounded concurrency, returning settled results. */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<SettledResult<R>[]> {
  const semaphore = new Semaphore(concurrency);
  const results: SettledResult<R>[] = new Array(items.length);

  await Promise.all(
    items.map(async (item, index) => {
      await semaphore.acquire();
      try {
        results[index] = { status: 'fulfilled', value: await fn(item, index) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      } finally {
        semaphore.release();
      }
    })
  );

  return results;
}