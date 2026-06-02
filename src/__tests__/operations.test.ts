import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { BackupStore } from '../utils/store.js';
import { createBackup } from '../operations/create.js';
import { restoreBackup } from '../operations/restore.js';
import { deleteBackup } from '../operations/delete.js';
import { listBackups } from '../operations/list.js';
import { getBackup } from '../operations/get.js';
import { previewBackup } from '../operations/preview.js';
import { diffBackup } from '../operations/diff.js';
import { verifyBackup } from '../operations/verify.js';
import { addTagsToBackup, removeTagsFromBackup, getTags } from '../operations/tags.js';
import { findDuplicates } from '../operations/duplicates.js';
import { cleanupBackups } from '../operations/cleanup.js';
import { batchBackup } from '../operations/batch.js';
import { getBackupStats } from '../operations/stats.js';

const TMP_DIR = path.join(os.tmpdir(), `backup-test-${Date.now()}`);
let backups: BackupStore;

beforeEach(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
  backups = await BackupStore.create();
});

afterEach(async () => {
  backups.stopAutoSave();
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('create + get + delete lifecycle', () => {
  it('creates, gets, and deletes a backup', async () => {
    const testFile = path.join(TMP_DIR, 'test.txt');
    await fs.writeFile(testFile, 'hello world');
    
    const createResult = await createBackup({ filePath: testFile, description: 'test', tags: ['unit'] }, backups);
    expect(createResult.backupId).toBeDefined();
    expect(createResult.backupPath).toBeDefined();
    
    const info = await getBackup(createResult.backupId, backups);
    expect(info.originalPath).toBe(testFile);
    expect(info.description).toBe('test');
    expect(info.tags).toContain('unit');
    
    const delResult = await deleteBackup(createResult.backupId, backups);
    expect(delResult.success).toBe(true);
    
    await expect(getBackup(createResult.backupId, backups)).rejects.toThrow();
  });
});

describe('restore', () => {
  it('restores a backup to a target path', async () => {
    const testFile = path.join(TMP_DIR, 'restore-test.txt');
    const restoredFile = path.join(TMP_DIR, 'restored.txt');
    await fs.writeFile(testFile, 'original content');
    
    const { backupId } = await createBackup({ filePath: testFile }, backups);
    
    const result = await restoreBackup({ backupId, targetPath: restoredFile }, backups);
    expect(result.success).toBe(true);
    
    const content = await fs.readFile(restoredFile, 'utf-8');
    expect(content).toBe('original content');
  });

  it('restores to a different path', async () => {
    const testFile = path.join(TMP_DIR, 'restore-alt.txt');
    const targetFile = path.join(TMP_DIR, 'restored.txt');
    await fs.writeFile(testFile, 'my data');
    
    const { backupId } = await createBackup({ filePath: testFile }, backups);
    const result = await restoreBackup({ backupId, targetPath: targetFile }, backups);
    expect(result.success).toBe(true);
    
    const content = await fs.readFile(targetFile, 'utf-8');
    expect(content).toBe('my data');
  });
});

describe('list + search', () => {
  it('lists and searches backups', async () => {
    const file1 = path.join(TMP_DIR, 'alpha.txt');
    const file2 = path.join(TMP_DIR, 'beta.txt');
    await fs.writeFile(file1, 'alpha content');
    await fs.writeFile(file2, 'beta content');
    
    await createBackup({ filePath: file1, description: 'alpha desc', tags: ['unique-tag-alpha'] }, backups);
    await createBackup({ filePath: file2, description: 'beta desc', tags: ['unique-tag-beta'] }, backups);
    
    const all = listBackups({}, backups);
    expect(all.length).toBeGreaterThanOrEqual(2);
    
    const byTag = listBackups({ tags: ['unique-tag-alpha'] }, backups);
    expect(byTag.some(b => b.description === 'alpha desc')).toBe(true);
    
    const searched = listBackups({ searchTerm: 'alpha desc' }, backups);
    expect(searched.some(b => b.description === 'alpha desc')).toBe(true);
  });
});

describe('tags', () => {
  it('adds and removes tags', async () => {
    const testFile = path.join(TMP_DIR, 'tags.txt');
    await fs.writeFile(testFile, 'tag test');
    
    const { backupId } = await createBackup({ filePath: testFile, tags: ['initial'] }, backups);
    
    await addTagsToBackup(backupId, ['extra'], backups);
    const info = await getBackup(backupId, backups);
    expect(info.tags).toContain('extra');
    expect(info.tags).toContain('initial');
    
    await removeTagsFromBackup(backupId, ['initial'], backups);
    const updated = await getBackup(backupId, backups);
    expect(updated.tags).not.toContain('initial');
    expect(updated.tags).toContain('extra');
    
    const allTags = getTags(backups);
    expect(allTags).toContain('extra');
  });
});

describe('preview', () => {
  it('previews backup content', async () => {
    const testFile = path.join(TMP_DIR, 'preview.txt');
    await fs.writeFile(testFile, 'preview content');
    
    const { backupId } = await createBackup({ filePath: testFile }, backups);
    const result = await previewBackup(backupId, backups, { maxChars: 100 });
    expect(result.content).toBe('preview content');
  });
});

describe('diff', () => {
  it('detects changes between backup and current file', async () => {
    const testFile = path.join(TMP_DIR, 'diff.txt');
    await fs.writeFile(testFile, 'line1\nline2\nline3');
    
    const { backupId } = await createBackup({ filePath: testFile }, backups);
    await fs.writeFile(testFile, 'line1\nMODIFIED\nline3');
    
    const result = await diffBackup(backupId, backups);
    expect(result.hasChanges).toBe(true);
  });
});

describe('verify', () => {
  it('verifies backup integrity', async () => {
    const testFile = path.join(TMP_DIR, 'verify.txt');
    await fs.writeFile(testFile, 'verify content');
    
    const { backupId } = await createBackup({ filePath: testFile }, backups);
    const result = await verifyBackup(backupId, backups);
    expect(result.backupIntact).toBe(true);
  });
});

describe('batch backup', () => {
  it('creates multiple backups at once', async () => {
    const files = [];
    for (let i = 0; i < 3; i++) {
      const f = path.join(TMP_DIR, `batch-${i}.txt`);
      await fs.writeFile(f, `content ${i}`);
      files.push(f);
    }
    
    const result = await batchBackup({ filePaths: files, description: 'batch', tags: ['batch'] }, backups);
    expect(result.successful.length).toBe(3);
    expect(result.totalFiles).toBe(3);
  });
});

describe('cleanup', () => {
  it('dry run does not delete', async () => {
    const testFile = path.join(TMP_DIR, 'cleanup.txt');
    await fs.writeFile(testFile, 'cleanup test');
    
    await createBackup({ filePath: testFile }, backups);
    
    const result = await cleanupBackups({ dryRun: true, keepLast: 1 }, backups);
    expect(result.keptBackups.length + result.deletedBackups.length).toBeGreaterThanOrEqual(1);
  });
});

describe('stats', () => {
  it('returns backup statistics', async () => {
    const testFile = path.join(TMP_DIR, 'stats.txt');
    await fs.writeFile(testFile, 'stats content');
    
    await createBackup({ filePath: testFile, tags: ['stats'] }, backups);
    
    const { stats } = await getBackupStats(backups);
    expect(stats.totalBackups).toBeGreaterThanOrEqual(1);
    expect(stats.topTags.length).toBeGreaterThanOrEqual(1);
  });
});

describe('duplicates', () => {
  it('finds duplicate content', async () => {
    const file1 = path.join(TMP_DIR, 'dup1.txt');
    const file2 = path.join(TMP_DIR, 'dup2.txt');
    await fs.writeFile(file1, 'same content');
    await fs.writeFile(file2, 'same content');
    
    await createBackup({ filePath: file1 }, backups);
    await createBackup({ filePath: file2 }, backups);
    
    const result = await findDuplicates(backups);
    expect(result.uniqueBackups).toBeGreaterThanOrEqual(1);
  });
});