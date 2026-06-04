import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { batchBackup, formatBatchResult } from '../operations/batch.js';
import { BackupStore } from '../utils/store.js';
import { config } from '../utils/config.js';
import type { BatchBackupResult } from '../operations/batch.js';

const TMP_DIR = path.join(os.tmpdir(), `batch-test-${Date.now()}`);
let backups: BackupStore;
let originalAllowedRoots: string[];

beforeEach(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
  originalAllowedRoots = [...config.allowedRoots];
  config.allowedRoots = [TMP_DIR, fsSync.realpathSync(os.tmpdir()), ...config.allowedRoots];
  backups = await BackupStore.create();
});

afterEach(async () => {
  config.allowedRoots = originalAllowedRoots;
  backups.stopAutoSave();
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('batchBackup', () => {
  it('backs up multiple files successfully', async () => {
    const files = [];
    for (let i = 0; i < 3; i++) {
      const f = path.join(TMP_DIR, `batch-${i}.txt`);
      await fs.writeFile(f, `content ${i}`);
      files.push(f);
    }
    const result = await batchBackup({ filePaths: files, description: 'batch test', tags: ['batch'] }, backups);
    expect(result.successful.length).toBe(3);
    expect(result.failed.length).toBe(0);
    expect(result.totalFiles).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.failCount).toBe(0);
  });

  it('backs up files with shared description and tags', async () => {
    const files = [];
    for (let i = 0; i < 2; i++) {
      const f = path.join(TMP_DIR, `shared-${i}.txt`);
      await fs.writeFile(f, `data ${i}`);
      files.push(f);
    }
    const result = await batchBackup({
      filePaths: files,
      description: 'shared desc',
      tags: ['shared'],
      projectContext: 'my-project',
    }, backups);
    expect(result.successful.length).toBe(2);
    for (const s of result.successful) {
      const backup = backups.get(s.backupId);
      expect(backup).toBeDefined();
      expect(backup!.metadata.tags).toContain('batch');
      expect(backup!.metadata.tags).toContain('shared');
    }
  });

  it('reports failures for missing files', async () => {
    const files = [
      path.join(TMP_DIR, 'exists.txt'),
      '/nonexistent/path/missing.txt',
    ];
    await fs.writeFile(files[0], 'exists');
    const result = await batchBackup({ filePaths: files, tags: [] }, backups);
    expect(result.successful.length).toBe(1);
    expect(result.failed.length).toBe(1);
    expect(result.failCount).toBe(1);
  });

  it('handles empty file list', async () => {
    const result = await batchBackup({ filePaths: [], tags: [] }, backups);
    expect(result.successful.length).toBe(0);
    expect(result.failed.length).toBe(0);
    expect(result.totalFiles).toBe(0);
  });

  it('uses default description when none provided', async () => {
    const f = path.join(TMP_DIR, 'default-desc.txt');
    await fs.writeFile(f, 'default');
    const result = await batchBackup({ filePaths: [f], tags: [] }, backups);
    expect(result.successful.length).toBe(1);
    const backup = backups.get(result.successful[0].backupId);
    expect(backup!.metadata.description).toContain('Batch');
  });
});

describe('formatBatchResult', () => {
  it('formats successful result', () => {
    const result: BatchBackupResult = {
      successful: [{ filePath: '/tmp/a.txt', backupId: 'id1' }],
      failed: [],
      totalFiles: 1,
      successCount: 1,
      failCount: 0,
    };
    const text = formatBatchResult(result);
    expect(text).toContain('Batch Backup Complete');
    expect(text).toContain('1/1');
    expect(text).toContain('/tmp/a.txt');
    expect(text).toContain('id1');
  });

  it('formats result with failures', () => {
    const result: BatchBackupResult = {
      successful: [],
      failed: [{ filePath: '/tmp/b.txt', error: 'not found' }],
      totalFiles: 1,
      successCount: 0,
      failCount: 1,
    };
    const text = formatBatchResult(result);
    expect(text).toContain('Failed');
    expect(text).toContain('not found');
  });

  it('formats empty result', () => {
    const result: BatchBackupResult = {
      successful: [],
      failed: [],
      totalFiles: 0,
      successCount: 0,
      failCount: 0,
    };
    const text = formatBatchResult(result);
    expect(text).toContain('0/0');
  });

  it('formats mixed result', () => {
    const result: BatchBackupResult = {
      successful: [
        { filePath: '/tmp/a.txt', backupId: 'id1' },
        { filePath: '/tmp/b.txt', backupId: 'id2' },
      ],
      failed: [{ filePath: '/tmp/c.txt', error: 'no access' }],
      totalFiles: 3,
      successCount: 2,
      failCount: 1,
    };
    const text = formatBatchResult(result);
    expect(text).toContain('2/3');
    expect(text).toContain('/tmp/a.txt');
    expect(text).toContain('/tmp/c.txt');
  });
});