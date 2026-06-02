import { describe, it, expect } from 'vitest';
import { formatFileSize, formatRelativeDate, formatBackupEntry, formatBackupList, formatCleanupResult, formatTagList } from '../utils/formatting.js';
import { BackupMetadata } from '../types/index.js';

const now = new Date().toISOString();
const baseMeta: BackupMetadata = {
  id: 'test123',
  originalPath: '/project/src/index.ts',
  timestamp: now,
  description: 'Test backup',
  tags: ['important', 'src'],
  size: 1024,
};

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0.00 B');
    expect(formatFileSize(512)).toBe('512.00 B');
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(1073741824)).toBe('1.00 GB');
  });
});

describe('formatRelativeDate', () => {
  it('returns relative time strings', () => {
    const result = formatRelativeDate(now);
    expect(result).toContain('ago');
  });
});

describe('formatBackupEntry', () => {
  it('formats a single backup entry', () => {
    const result = formatBackupEntry(baseMeta);
    expect(result).toContain('test123');
    expect(result).toContain('index.ts');
    expect(result).toContain('#important');
    expect(result).toContain('#src');
  });
});

describe('formatBackupList', () => {
  it('handles empty list', () => {
    expect(formatBackupList([])).toContain('No backups found');
  });

  it('formats list with entries', () => {
    const result = formatBackupList([baseMeta]);
    expect(result).toContain('test123');
  });
});

describe('formatCleanupResult', () => {
  it('formats cleanup summary', () => {
    const result = formatCleanupResult({ deletedCount: 3, freedSpace: 1024, keptCount: 5 });
    expect(result).toContain('3');
    expect(result).toContain('1.00 KB');
  });
});

describe('formatTagList', () => {
  it('formats tag list', () => {
    const result = formatTagList(['important', 'src']);
    expect(result).toContain('important');
    expect(result).toContain('src');
  });
});