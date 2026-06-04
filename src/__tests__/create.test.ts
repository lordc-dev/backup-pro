import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { createBackup } from '../operations/create.js';
import { BackupStore } from '../utils/store.js';
import { config } from '../utils/config.js';

const TMP_DIR = path.join(os.tmpdir(), `create-test-${Date.now()}`);
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

describe('createBackup', () => {
  it('creates a backup with description and tags', async () => {
    const testFile = path.join(TMP_DIR, 'desc.txt');
    await fs.writeFile(testFile, 'hello');
    const result = await createBackup({
      filePath: testFile,
      description: 'my backup',
      tags: ['important'],
    }, backups);
    expect(result.backupId).toBeDefined();
    expect(result.backupPath).toBeDefined();
  });

  it('creates a backup with related files and project context', async () => {
    const testFile = path.join(TMP_DIR, 'ctx.txt');
    await fs.writeFile(testFile, 'context test');
    const result = await createBackup({
      filePath: testFile,
      relatedFiles: ['/tmp/related1.txt'],
      projectContext: 'my-project',
    }, backups);
    expect(result.backupId).toBeDefined();
  });

  it('creates a backup with empty tags', async () => {
    const testFile = path.join(TMP_DIR, 'notags.txt');
    await fs.writeFile(testFile, 'no tags');
    const result = await createBackup({
      filePath: testFile,
      tags: [],
    }, backups);
    expect(result.backupId).toBeDefined();
  });

  it('throws for nonexistent file', async () => {
    await expect(createBackup({
      filePath: '/nonexistent/path/file.txt',
    }, backups)).rejects.toThrow();
  });

  it('throws for directory path', async () => {
    const dirPath = path.join(TMP_DIR, 'subdir');
    await fs.mkdir(dirPath, { recursive: true });
    await expect(createBackup({
      filePath: dirPath,
    }, backups)).rejects.toThrow();
  });

  it('generates default description when none provided', async () => {
    const testFile = path.join(TMP_DIR, 'defaultdesc.txt');
    await fs.writeFile(testFile, 'content');
    const result = await createBackup({
      filePath: testFile,
    }, backups);
    expect(result.backupId).toBeDefined();
    const backup = backups.get(result.backupId);
    expect(backup).toBeDefined();
    expect(backup!.metadata.description).toContain('defaultdesc');
  });

  it('stores metadata with file hash', async () => {
    const testFile = path.join(TMP_DIR, 'hashcheck.txt');
    await fs.writeFile(testFile, 'hashable content');
    const result = await createBackup({
      filePath: testFile,
    }, backups);
    const backup = backups.get(result.backupId);
    expect(backup).toBeDefined();
    expect(backup!.metadata.fileHash).toBeDefined();
  });

  it('creates backup file that matches original content', async () => {
    const testFile = path.join(TMP_DIR, 'verify-content.txt');
    await fs.writeFile(testFile, 'verify me');
    const result = await createBackup({
      filePath: testFile,
    }, backups);
    const backup = backups.get(result.backupId);
    const content = await fs.readFile(backup!.backupPath, 'utf-8');
    expect(content).toBe('verify me');
  });

  it('handles multiple backups of same file', async () => {
    const testFile = path.join(TMP_DIR, 'multi.txt');
    await fs.writeFile(testFile, 'multi backup');
    const r1 = await createBackup({ filePath: testFile, tags: ['v1'] }, backups);
    const r2 = await createBackup({ filePath: testFile, tags: ['v2'] }, backups);
    expect(r1.backupId).not.toBe(r2.backupId);
  });
});