import { describe, it, expect } from 'vitest';
import { calculateFileHash, generateBackupId, generateBackupFileName, parseBackupFileName } from '../utils/hashing.js';

describe('calculateFileHash', () => {
  it('produces consistent SHA-256 hashes', () => {
    const content = 'test content';
    const hash1 = calculateFileHash(content);
    const hash2 = calculateFileHash(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hashes for different content', () => {
    expect(calculateFileHash('a')).not.toBe(calculateFileHash('b'));
  });

  it('accepts Buffer input', () => {
    const hash = calculateFileHash(Buffer.from('test'));
    expect(hash).toHaveLength(64);
  });
});

describe('generateBackupId', () => {
  it('produces 12-char hex ids', () => {
    const id = generateBackupId('/test/file.txt', '2024-01-15T10:00:00Z');
    expect(id).toHaveLength(12);
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

describe('parseBackupFileName', () => {
  it('returns timestamp from valid filename', () => {
    const name = 'index.ts.abc123.2024-01-15T10-30-00.000Z.backup';
    const result = parseBackupFileName(name);
    expect(result.timestamp).not.toBeNull();
  });

  it('returns null for invalid filename', () => {
    const result = parseBackupFileName('too-short');
    expect(result.timestamp).toBeNull();
  });
});