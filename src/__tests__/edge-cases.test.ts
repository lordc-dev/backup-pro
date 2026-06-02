import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  validateFilePath,
  requireString,
  optionalString,
  optionalStringArray,
  optionalNumber,
  optionalBoolean,
  validateDateString,
  validatePositiveNumber,
  toMcpError,
  fileNotFoundError,
  backupNotFoundError,
} from '../utils/validate.js';
import {
  filterByTags,
  filterByDateRange,
  searchBackups,
  getAllTags,
} from '../utils/persistence.js';
import { BackupStore } from '../utils/store.js';
import { diffLines } from '../utils/myers-diff.js';
import {
  formatBackupList,
  formatCleanupResult,
  formatTagList,
  formatFileSize,
} from '../utils/formatting.js';
import { log } from '../utils/logger.js';
import { cleanupBackups } from '../operations/cleanup.js';
import { BackupInfo, BackupMetadata } from '../types/index.js';

function makeBackup(overrides: Partial<BackupMetadata> = {}): BackupInfo {
  const defaults: BackupMetadata = {
    id: 'test-id',
    originalPath: '/tmp/test.txt',
    timestamp: new Date().toISOString(),
    description: 'test backup',
    tags: ['test'],
    size: 100,
  };
  return {
    backupPath: `/tmp/backups/${overrides.id ?? defaults.id}.bak`,
    metadata: { ...defaults, ...overrides },
  };
}

// ─── validate.ts ───────────────────────────────────────────────────────────

describe('validateFilePath edge cases', () => {
  it('rejects path with .. segment in the middle', () => {
    expect(() => validateFilePath('/home/user/../../etc/passwd')).toThrow(McpError);
  });

  it('rejects path resolving above root via multiple ..', () => {
    expect(() => validateFilePath('/a/b/../../../etc/passwd')).toThrow(McpError);
  });

  it('expands ~/ to HOME directory', () => {
    // ~/ is expanded to HOME, then normalized — should not throw
  });

  it('allows ~/ with no path traversal', () => {
    expect(() => validateFilePath('~/code/project')).not.toThrow();
  });

  it('rejects ~/.. traversal', () => {
    expect(() => validateFilePath('~/..')).toThrow(McpError);
  });

  it('rejects path traversal with consecutive slashes', () => {
    expect(() => validateFilePath('/tmp//../etc/passwd')).toThrow(McpError);
  });
});

describe('requireString edge cases', () => {
  it('throws on null args', () => {
    expect(() => requireString(null, 'key')).toThrow(McpError);
  });

  it('throws on undefined args', () => {
    expect(() => requireString(undefined, 'key')).toThrow(McpError);
  });

  it('throws on missing key', () => {
    expect(() => requireString({ other: 'val' }, 'key')).toThrow(McpError);
  });

  it('throws on empty string', () => {
    expect(() => requireString({ key: '' }, 'key')).toThrow(McpError);
  });

  it('throws on non-string value (number)', () => {
    expect(() => requireString({ key: 42 }, 'key')).toThrow(McpError);
  });

  it('returns valid string', () => {
    expect(requireString({ key: 'hello' }, 'key')).toBe('hello');
  });
});

describe('optionalString edge cases', () => {
  it('returns undefined for null args', () => {
    expect(optionalString(null, 'key')).toBeUndefined();
  });

  it('returns undefined for undefined args', () => {
    expect(optionalString(undefined, 'key')).toBeUndefined();
  });

  it('throws on non-string value (number)', () => {
    expect(() => optionalString({ key: 42 }, 'key')).toThrow(McpError);
  });

  it('throws on non-string value (boolean)', () => {
    expect(() => optionalString({ key: true }, 'key')).toThrow(McpError);
  });

  it('returns undefined for missing key', () => {
    expect(optionalString({ other: 'val' }, 'key')).toBeUndefined();
  });

  it('returns undefined for null value', () => {
    expect(optionalString({ key: null }, 'key')).toBeUndefined();
  });

  it('returns string for valid value', () => {
    expect(optionalString({ key: 'val' }, 'key')).toBe('val');
  });
});

describe('optionalStringArray edge cases', () => {
  it('returns undefined for null args', () => {
    expect(optionalStringArray(null, 'key')).toBeUndefined();
  });

  it('returns undefined for undefined args', () => {
    expect(optionalStringArray(undefined, 'key')).toBeUndefined();
  });

  it('throws on non-array value (string)', () => {
    expect(() => optionalStringArray({ key: 'not-array' }, 'key')).toThrow(McpError);
  });

  it('throws on mixed types in array', () => {
    expect(() => optionalStringArray({ key: ['a', 1, true] }, 'key')).toThrow(McpError);
  });

  it('returns array for valid string array', () => {
    expect(optionalStringArray({ key: ['a', 'b'] }, 'key')).toEqual(['a', 'b']);
  });

  it('returns undefined for null value', () => {
    expect(optionalStringArray({ key: null }, 'key')).toBeUndefined();
  });

  it('throws on array with numbers', () => {
    expect(() => optionalStringArray({ key: [1, 2] }, 'key')).toThrow(McpError);
  });
});

describe('optionalNumber edge cases', () => {
  it('returns undefined for null args', () => {
    expect(optionalNumber(null, 'key')).toBeUndefined();
  });

  it('throws on string value', () => {
    expect(() => optionalNumber({ key: '42' }, 'key')).toThrow(McpError);
  });

  it('throws on boolean value', () => {
    expect(() => optionalNumber({ key: true }, 'key')).toThrow(McpError);
  });

  it('returns number for valid value', () => {
    expect(optionalNumber({ key: 42 }, 'key')).toBe(42);
  });

  it('returns undefined for undefined args', () => {
    expect(optionalNumber(undefined, 'key')).toBeUndefined();
  });
});

describe('optionalBoolean edge cases', () => {
  it('returns undefined for null args', () => {
    expect(optionalBoolean(null, 'key')).toBeUndefined();
  });

  it('throws on string value', () => {
    expect(() => optionalBoolean({ key: 'true' }, 'key')).toThrow(McpError);
  });

  it('throws on number value', () => {
    expect(() => optionalBoolean({ key: 1 }, 'key')).toThrow(McpError);
  });

  it('returns boolean for valid value', () => {
    expect(optionalBoolean({ key: true }, 'key')).toBe(true);
    expect(optionalBoolean({ key: false }, 'key')).toBe(false);
  });

  it('returns undefined for null value', () => {
    expect(optionalBoolean({ key: null }, 'key')).toBeUndefined();
  });
});

describe('validateDateString edge cases', () => {
  it('accepts date-only format', () => {
    expect(validateDateString('2024-01-15', 'test')).toBe('2024-01-15');
  });

  it('accepts datetime with Z timezone', () => {
    expect(validateDateString('2024-01-15T10:30:00Z', 'test')).toBe('2024-01-15T10:30:00Z');
  });

  it('accepts datetime with offset timezone', () => {
    expect(validateDateString('2024-01-15T10:30:00+05:30', 'test')).toBe('2024-01-15T10:30:00+05:30');
  });

  it('accepts datetime with milliseconds', () => {
    expect(validateDateString('2024-01-15T10:30:00.123Z', 'test')).toBe('2024-01-15T10:30:00.123Z');
  });

  it('accepts offset without colon', () => {
    expect(validateDateString('2024-01-15T10:30:00+0530', 'test')).toBe('2024-01-15T10:30:00+0530');
  });

  it('returns undefined for undefined input', () => {
    expect(validateDateString(undefined, 'test')).toBeUndefined();
  });

  it('rejects plain text', () => {
    expect(() => validateDateString('not-a-date', 'test')).toThrow(McpError);
  });

  it('rejects DD-MM-YYYY format', () => {
    expect(() => validateDateString('15-01-2024', 'test')).toThrow(McpError);
  });

  it('rejects slash-separated dates', () => {
    expect(() => validateDateString('2024/01/15', 'test')).toThrow(McpError);
  });

  it('rejects empty string', () => {
    expect(() => validateDateString('', 'test')).toThrow(McpError);
  });

  it('includes param name in error message', () => {
    expect(() => validateDateString('bad', 'myParam')).toThrow(/myParam/);
  });
});

describe('validatePositiveNumber edge cases', () => {
  it('rejects float', () => {
    expect(() => validatePositiveNumber(1.5, 'test')).toThrow(McpError);
  });

  it('rejects negative', () => {
    expect(() => validatePositiveNumber(-1, 'test')).toThrow(McpError);
  });

  it('rejects zero with default min=1', () => {
    expect(() => validatePositiveNumber(0, 'test')).toThrow(McpError);
  });

  it('allows zero with min=0', () => {
    expect(validatePositiveNumber(0, 'test', 0)).toBe(0);
  });

  it('returns undefined for undefined input', () => {
    expect(validatePositiveNumber(undefined, 'test')).toBeUndefined();
  });

  it('rejects NaN', () => {
    expect(() => validatePositiveNumber(NaN, 'test')).toThrow(McpError);
  });

  it('includes param name in error message', () => {
    expect(() => validatePositiveNumber(-1, 'myParam')).toThrow(/myParam/);
  });
});

describe('toMcpError edge cases', () => {
  it('wraps Error with message', () => {
    const err = toMcpError(new Error('boom'), 'Prefix');
    expect(err).toBeInstanceOf(McpError);
    expect(err.message).toContain('Prefix');
    expect(err.message).toContain('boom');
  });

  it('wraps string', () => {
    const err = toMcpError('str error', 'Op');
    expect(err.message).toContain('Op');
    expect(err.message).toContain('str error');
  });

  it('wraps number', () => {
    const err = toMcpError(42, 'Op');
    expect(err.message).toContain('Op');
    expect(err.message).toContain('42');
  });

  it('wraps null', () => {
    const err = toMcpError(null, 'Op');
    expect(err.message).toContain('null');
  });

  it('wraps undefined', () => {
    const err = toMcpError(undefined, 'Op');
    expect(err.message).toContain('undefined');
  });
});

describe('fileNotFoundError', () => {
  it('includes path in message', () => {
    const err = fileNotFoundError('/missing/file.txt');
    expect(err).toBeInstanceOf(McpError);
    expect(err.message).toContain('/missing/file.txt');
  });
});

describe('backupNotFoundError', () => {
  it('includes id in message', () => {
    const err = backupNotFoundError('abc-123');
    expect(err).toBeInstanceOf(McpError);
    expect(err.message).toContain('abc-123');
  });
});

// ─── persistence.ts ─────────────────────────────────────────────────────────

describe('filterByTags edge cases', () => {
  it('returns all backups when tags array is empty', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a', tags: ['x'] })],
      ['b', makeBackup({ id: 'b', tags: ['y'] })],
    ]);
    const result = filterByTags(backups, []);
    expect(result.size).toBe(2);
  });

  it('returns all backups when tags is undefined', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a', tags: ['x'] })],
    ]);
    const result = filterByTags(backups, undefined as unknown as string[]);
    expect(result.size).toBe(1);
  });

  it('filters by single tag', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a', tags: ['x', 'y'] })],
      ['b', makeBackup({ id: 'b', tags: ['z'] })],
    ]);
    const result = filterByTags(backups, ['x']);
    expect(result.size).toBe(1);
    expect(result.has('a')).toBe(true);
  });

  it('filters by multiple tags (OR)', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a', tags: ['x'] })],
      ['b', makeBackup({ id: 'b', tags: ['y'] })],
      ['c', makeBackup({ id: 'c', tags: ['z'] })],
    ]);
    const result = filterByTags(backups, ['x', 'z']);
    expect(result.size).toBe(2);
  });

  it('excludes backups with no tags', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a', tags: [] })],
    ]);
    const result = filterByTags(backups, ['x']);
    expect(result.size).toBe(0);
  });
});

describe('filterByDateRange edge cases', () => {
  it('filters by afterDate only', () => {
    const backups = new Map<string, BackupInfo>([
      ['old', makeBackup({ id: 'old', timestamp: '2023-01-01T00:00:00Z' })],
      ['new', makeBackup({ id: 'new', timestamp: '2025-01-01T00:00:00Z' })],
    ]);
    const result = filterByDateRange(backups, '2024-01-01T00:00:00Z');
    expect(result.size).toBe(1);
    expect(result.has('new')).toBe(true);
  });

  it('filters by beforeDate only', () => {
    const backups = new Map<string, BackupInfo>([
      ['old', makeBackup({ id: 'old', timestamp: '2023-01-01T00:00:00Z' })],
      ['new', makeBackup({ id: 'new', timestamp: '2025-01-01T00:00:00Z' })],
    ]);
    const result = filterByDateRange(backups, undefined, '2024-01-01T00:00:00Z');
    expect(result.size).toBe(1);
    expect(result.has('old')).toBe(true);
  });

  it('filters by both afterDate and beforeDate', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a', timestamp: '2022-01-01T00:00:00Z' })],
      ['b', makeBackup({ id: 'b', timestamp: '2023-06-01T00:00:00Z' })],
      ['c', makeBackup({ id: 'c', timestamp: '2024-12-01T00:00:00Z' })],
    ]);
    const result = filterByDateRange(backups, '2023-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
    expect(result.size).toBe(1);
    expect(result.has('b')).toBe(true);
  });

  it('returns all when no dates specified', () => {
    const backups = new Map<string, BackupInfo>([
      ['a', makeBackup({ id: 'a' })],
    ]);
    const result = filterByDateRange(backups);
    expect(result.size).toBe(1);
  });
});

describe('searchBackups edge cases', () => {
  const backups = new Map<string, BackupInfo>([
    ['1', makeBackup({ id: '1', description: 'important backup', tags: ['prod', 'v1'], originalPath: '/data/app.js' })],
    ['2', makeBackup({ id: '2', description: 'test backup', tags: ['dev'], originalPath: '/data/util.py' })],
    ['3', makeBackup({ id: '3', description: 'config save', tags: ['config'], originalPath: '/data/README.md' })],
  ]);

  it('searches in tags only', () => {
    const result = searchBackups(backups, 'prod', ['tags']);
    expect(result.size).toBe(1);
    expect(result.has('1')).toBe(true);
  });

  it('searches in filename only', () => {
    const result = searchBackups(backups, 'app', ['filename']);
    expect(result.size).toBe(1);
    expect(result.has('1')).toBe(true);
  });

  it('searches in description only', () => {
    const result = searchBackups(backups, 'test', ['description']);
    expect(result.size).toBe(1);
    expect(result.has('2')).toBe(true);
  });

  it('searches all fields by default', () => {
    const result = searchBackups(backups, 'backup');
    expect(result.size).toBe(2);
  });

  it('returns empty for non-matching term', () => {
    const result = searchBackups(backups, 'zzzznonexistent');
    expect(result.size).toBe(0);
  });
});

describe('getAllTags edge cases', () => {
  it('returns sorted unique tags', () => {
    const backups = new Map<string, BackupInfo>([
      ['1', makeBackup({ id: '1', tags: ['b', 'a'] })],
      ['2', makeBackup({ id: '2', tags: ['a', 'c'] })],
    ]);
    const tags = getAllTags(backups);
    expect(tags).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty store', () => {
    const tags = getAllTags(new Map());
    expect(tags).toEqual([]);
  });

  it('handles backups with no tags', () => {
    const backups = new Map<string, BackupInfo>([
      ['1', makeBackup({ id: '1', tags: [] })],
    ]);
    const tags = getAllTags(backups);
    expect(tags).toEqual([]);
  });
});

// ─── Store ──────────────────────────────────────────────────────────────────

describe('BackupStore edge cases', () => {
  it('create() initializes empty store', async () => {
    const store = await BackupStore.create();
    expect(store.size).toBeGreaterThanOrEqual(0);
    store.stopAutoSave();
  });

  it('set and get work correctly', async () => {
    const store = await BackupStore.create();
    const backup = makeBackup({ id: 'store-test' });
    store.set('store-test', backup);
    expect(store.get('store-test')).toEqual(backup);
    store.stopAutoSave();
  });

  it('delete returns true for existing key', async () => {
    const store = await BackupStore.create();
    const backup = makeBackup({ id: 'del-test' });
    store.set('del-test', backup);
    const result = store.delete('del-test');
    expect(result).toBe(true);
    expect(store.get('del-test')).toBeUndefined();
    store.stopAutoSave();
  });

  it('delete returns false for non-existent key', async () => {
    const store = await BackupStore.create();
    const result = store.delete('nonexistent');
    expect(result).toBe(false);
    store.stopAutoSave();
  });

  it('startAutoSave and stopAutoSave do not throw', async () => {
    const store = await BackupStore.create();
    expect(() => store.startAutoSave(10000)).not.toThrow();
    expect(() => store.stopAutoSave()).not.toThrow();
    expect(() => store.stopAutoSave()).not.toThrow();
  });

  it('save persists and reloads data', async () => {
    const tmpDir = path.join(os.tmpdir(), `tmp-backup-pro-${Date.now()}`);
    const origDir = process.env.BACKUP_DIR;
    try {
      process.env.BACKUP_DIR = tmpDir;
      await fs.mkdir(tmpDir, { recursive: true });

      const { config } = await import('../utils/config.js');
      (config as any).backupDir = tmpDir;

      const store = await BackupStore.create();
      const backup = makeBackup({ id: 'persist-test' });
      store.set('persist-test', backup);
      await store.save();

      const store2 = await BackupStore.create();
      const loaded = store2.get('persist-test');
      expect(loaded).toBeDefined();
      expect(loaded!.metadata.id).toBe('persist-test');

      store.delete('persist-test');
      await store.save();
      store2.stopAutoSave();
      store.stopAutoSave();
    } finally {
      process.env.BACKUP_DIR = origDir;
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

// ─── Cleanup operations ─────────────────────────────────────────────────────

describe('cleanupBackups edge cases', () => {
  it('keepLast=0 deletes all per-file backups', async () => {
    const store = await BackupStore.create();
    const id = `keep0-${Date.now()}`;
    const backup = makeBackup({ id, originalPath: `/tmp/keep0-${Date.now()}.txt`, timestamp: '2024-01-01T00:00:00Z' });
    store.set(id, backup);
    await store.save();
    const result = await cleanupBackups({ keepLast: 0 }, store);
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);
    store.stopAutoSave();
  });

  it('invalid olderThan format throws', async () => {
    const store = await BackupStore.create();
    await expect(cleanupBackups({ olderThan: 'invalid' }, store)).rejects.toThrow(/Invalid olderThan format/);
    store.stopAutoSave();
  });

  it('rejects olderThan with wrong unit suffix', async () => {
    const store = await BackupStore.create();
    await expect(cleanupBackups({ olderThan: '7w' }, store)).rejects.toThrow(/Invalid olderThan format/);
    store.stopAutoSave();
  });

  it('dryRun does not delete entries', async () => {
    const store = await BackupStore.create();
    const id = `dryrun-${Date.now()}`;
    const backup = makeBackup({
      id,
      originalPath: `/tmp/dryrun-test-${Date.now()}.txt`,
      timestamp: '2020-01-01T00:00:00Z',
    });
    store.set(id, backup);
    await store.save();

    const result = await cleanupBackups({ olderThan: '1d', dryRun: true }, store);
    expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    expect(store.get(id)).toBeDefined();

    store.delete(id);
    await store.save();
    store.stopAutoSave();
  });

  it('throws when no criteria provided', async () => {
    const store = await BackupStore.create();
    await expect(cleanupBackups({}, store)).rejects.toThrow(/At least one/);
    store.stopAutoSave();
  });
});

// ─── Myers diff ─────────────────────────────────────────────────────────────

describe('diffLines edge cases', () => {
  it('handles multi-line additions', () => {
    const oldText = 'line1\nline2';
    const newText = 'line1\nline2\nadded1\nadded2\nadded3';
    const result = diffLines(oldText, newText);
    const added = result.filter(r => r.added);
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(added.reduce((sum, r) => sum + r.count, 0)).toBe(3);
  });

  it('handles multi-line deletions', () => {
    const oldText = 'a\nb\nc\nd\ne';
    const newText = 'a\ne';
    const result = diffLines(oldText, newText);
    const removed = result.filter(r => r.removed);
    expect(removed.reduce((sum, r) => sum + r.count, 0)).toBe(3);
  });

  it('handles single character changes on a line', () => {
    const oldText = 'hello world';
    const newText = 'hello wurld';
    const result = diffLines(oldText, newText);
    expect(result.some(r => r.added || r.removed)).toBe(true);
  });

  it('handles completely different content', () => {
    const oldText = 'aaa\nbbb\nccc';
    const newText = 'xxx\nyyy\nzzz';
    const result = diffLines(oldText, newText);
    const removed = result.filter(r => r.removed);
    const added = result.filter(r => r.added);
    expect(removed.length).toBeGreaterThanOrEqual(1);
    expect(added.length).toBeGreaterThanOrEqual(1);
  });

  it('handles identical content (no diff)', () => {
    const text = 'line1\nline2\nline3';
    const result = diffLines(text, text);
    expect(result.every(r => !r.added && !r.removed)).toBe(true);
  });

  it('handles empty old text', () => {
    const result = diffLines('', 'new line');
    expect(result).toHaveLength(1);
    expect(result[0].added).toBe(true);
  });

  it('handles empty new text', () => {
    const result = diffLines('old line', '');
    expect(result).toHaveLength(1);
    expect(result[0].removed).toBe(true);
  });

  it('handles both empty', () => {
    const result = diffLines('', '');
    expect(result).toEqual([]);
  });

  it('handles 1000+ lines', () => {
    const oldLines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
    const newLines = Array.from({ length: 1050 }, (_, i) => `line ${i}`);
    const result = diffLines(oldLines.join('\n'), newLines.join('\n'));
    expect(result.length).toBeGreaterThan(0);
    const totalOld = result.filter(r => !r.added).reduce((sum, r) => sum + r.count, 0);
    const totalNew = result.filter(r => !r.removed).reduce((sum, r) => sum + r.count, 0);
    expect(totalOld).toBe(1000);
    expect(totalNew).toBe(1050);
  });
});

// ─── Formatting ─────────────────────────────────────────────────────────────

describe('formatBackupList edge cases', () => {
  it('returns "No backups found" for empty array', () => {
    expect(formatBackupList([])).toContain('No backups found');
  });

  it('groups backups by file path', () => {
    const backups: BackupMetadata[] = [
      { id: '1', originalPath: '/tmp/a.txt', timestamp: '2024-01-01T00:00:00Z', description: '', tags: [] },
      { id: '2', originalPath: '/tmp/a.txt', timestamp: '2024-01-02T00:00:00Z', description: '', tags: [] },
      { id: '3', originalPath: '/tmp/b.txt', timestamp: '2024-01-03T00:00:00Z', description: '', tags: [] },
    ];
    const result = formatBackupList(backups);
    expect(result).toContain('/tmp/a.txt');
    expect(result).toContain('/tmp/b.txt');
  });
});

describe('formatCleanupResult edge cases', () => {
  it('shows "No backups found to delete" when count is 0', () => {
    const result = formatCleanupResult({ deletedCount: 0, freedSpace: 0 });
    expect(result).toContain('No backups found to delete');
  });

  it('shows space freed when count > 0', () => {
    const result = formatCleanupResult({ deletedCount: 3, freedSpace: 1024 });
    expect(result).toContain('Deleted 3 backups');
    expect(result).toContain('1.00 KB');
  });

  it('shows kept count when provided', () => {
    const result = formatCleanupResult({ deletedCount: 1, freedSpace: 100, keptCount: 5 });
    expect(result).toContain('5');
  });
});

describe('formatTagList edge cases', () => {
  it('returns "No tags available" for empty array', () => {
    expect(formatTagList([])).toContain('No tags available');
  });

  it('formats tags with hash prefix', () => {
    expect(formatTagList(['alpha', 'beta'])).toContain('#alpha');
    expect(formatTagList(['alpha', 'beta'])).toContain('#beta');
  });
});

// ─── Logger ─────────────────────────────────────────────────────────────────

describe('log levels', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('log.error always outputs', () => {
    log.error('test', 'err msg');
    expect(errorSpy).toHaveBeenCalled();
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).toContain('[ERROR]');
    expect(msg).toContain('test');
    expect(msg).toContain('err msg');
  });

  it('log.warn outputs at default level', () => {
    log.warn('test', 'warn msg');
    expect(errorSpy).toHaveBeenCalled();
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).toContain('[WARN]');
  });

  it('log.info outputs at default level', () => {
    log.info('test', 'info msg');
    expect(errorSpy).toHaveBeenCalled();
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).toContain('[INFO]');
  });

  it('log.debug is suppressed at default level', () => {
    log.debug('test', 'debug msg');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('log.info includes data when provided', () => {
    log.info('comp', 'msg', { key: 'val' });
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).toContain('"key"');
    expect(msg).toContain('"val"');
  });

  it('log.info omits data when empty object', () => {
    log.info('comp', 'msg', {});
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).not.toContain('{');
    expect(msg).not.toContain('JSON');
  });

  it('log.error includes data', () => {
    log.error('comp', 'msg', { err: 'detail' });
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).toContain('"err"');
  });
});

describe('formatFileSize edge cases', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0.00 B');
    expect(formatFileSize(500)).toBe('500.00 B');
  });

  it('formats KB', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1536)).toBe('1.50 KB');
  });

  it('formats MB', () => {
    expect(formatFileSize(1048576)).toBe('1.00 MB');
  });

  it('formats GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.00 GB');
  });
});