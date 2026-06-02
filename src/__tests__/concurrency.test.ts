import { describe, it, expect } from 'vitest';
import { Semaphore, parallelMap } from '../utils/concurrency.js';

describe('Semaphore', () => {
  it('allows up to maxConcurrency concurrent acquires', async () => {
    const sem = new Semaphore(3);
    const acquired: number[] = [];

    const p1 = sem.acquire().then(() => { acquired.push(1); });
    const p2 = sem.acquire().then(() => { acquired.push(2); });
    const p3 = sem.acquire().then(() => { acquired.push(3); });

    await Promise.all([p1, p2, p3]);
    expect(acquired).toHaveLength(3);
  });

  it('blocks when capacity is reached', async () => {
    const sem = new Semaphore(1);
    let released = false;

    await sem.acquire();
    const blocked = sem.acquire().then(() => { expect(released).toBe(true); });
    released = true;
    sem.release();
    await blocked;
  });
});

describe('parallelMap', () => {
  it('maps items with concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5];
    const order: number[] = [];

    const results = await parallelMap(items, async (item) => {
      order.push(item);
      return item * 2;
    }, 2);

    expect(results.map(r => r.status === 'fulfilled' ? r.value : null)).toEqual([2, 4, 6, 8, 10]);
  });

  it('captures rejections', async () => {
    const results = await parallelMap([1, 2, 3], async (item) => {
      if (item === 2) throw new Error('fail');
      return item;
    }, 3);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });
});