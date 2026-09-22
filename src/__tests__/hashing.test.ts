import { describe, it, expect } from 'vitest';
import { generateBackupId, generateBackupFileName } from '../utils/hashing.js';

describe('generateBackupId', () => {
  it('produces 16-char hex ids', () => {
    const id = generateBackupId('/test/file.txt', '2024-01-15T10:00:00.000Z');
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[a-f0-9]+$/);
  });

  it('produces different ids for different inputs', () => {
    const id1 = generateBackupId('/test/a.txt', '2024-01-15T10:00:00Z');
    const id2 = generateBackupId('/test/b.txt', '2024-01-15T10:00:00Z');
    expect(id1).not.toBe(id2);
  });
});

describe('generateBackupFileName', () => {
  it('includes original name, id, and timestamp', () => {
    const name = generateBackupFileName('/project/src/index.ts', 'abc123', '2024-01-15T10:30:00Z');
    expect(name).toContain('index.ts');
    expect(name).toContain('abc123');
    expect(name).toContain('backup');
  });
});