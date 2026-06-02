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