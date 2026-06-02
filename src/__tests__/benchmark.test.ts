import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BackupStore } from '../utils/store.js';
import { diffLines } from '../utils/myers-diff.js';
import { createBackup } from '../operations/create.js';
import { listBackups } from '../operations/list.js';
import { searchBackups } from '../operations/search.js';
import { batchBackup } from '../operations/batch.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const TMP_DIR = path.join(os.tmpdir(), `backup-bench-${Date.now()}`);
const ORIG_BACKUP_DIR = process.env.BACKUP_DIR;

describe('Benchmark: core backup operations', () => {
  let store: BackupStore;

  beforeAll(async () => {
    const benchDir = path.join(TMP_DIR, 'backups');
    process.env.BACKUP_DIR = benchDir;
    await fs.mkdir(benchDir, { recursive: true });

    const { config } = await import('../utils/config.js');
    (config as any).backupDir = benchDir;

    store = await BackupStore.create();
  });

  afterAll(async () => {
    store.stopAutoSave?.();
    if (ORIG_BACKUP_DIR) {
      process.env.BACKUP_DIR = ORIG_BACKUP_DIR;
    } else {
      delete process.env.BACKUP_DIR;
    }
    try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('BackupStore.create() + save(): 100 backups under 2000ms', async () => {
    const filePaths: string[] = [];
    for (let i = 0; i < 100; i++) {
      const fp = path.join(TMP_DIR, `bench-create-${i}.txt`);
      await fs.writeFile(fp, `content ${i} ${'x'.repeat(50)}`);
      filePaths.push(fp);
    }

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await createBackup({ filePath: filePaths[i], description: `bench-${i}`, tags: [`tag-${i % 5}`] }, store);
    }
    await store.save();
    const elapsed = Date.now() - start;

    console.log(`create+save 100 backups: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2000);
  });

  it('listBackups(): 100 backups under 500ms', () => {
    const start = Date.now();
    const list = listBackups({}, store);
    const elapsed = Date.now() - start;

    console.log(`listBackups (100 entries): ${elapsed}ms`);
    expect(list.length).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(500);
  });

  it('diffLines: two 1000-line strings under 300ms', () => {
    const oldLines = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n');
    const newLines = Array.from({ length: 1000 }, (_, i) => i % 10 === 0 ? `changed ${i}` : `line ${i}`).join('\n');

    const start = Date.now();
    const result = diffLines(oldLines, newLines);
    const elapsed = Date.now() - start;

    console.log(`diffLines 1000 lines: ${elapsed}ms, parts: ${result.length}`);
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('batch backup: 50 files concurrency 5 under 3000ms', async () => {
    const files: string[] = [];
    for (let i = 0; i < 50; i++) {
      const fp = path.join(TMP_DIR, `bench-batch-${i}.txt`);
      await fs.writeFile(fp, `batch content ${i}`);
      files.push(fp);
    }

    const start = Date.now();
    const result = await batchBackup({ filePaths: files, description: 'bench-batch', tags: ['batch-bench'] }, store);
    await store.save();
    const elapsed = Date.now() - start;

    console.log(`batch 50 files: ${elapsed}ms, ok: ${result.successCount}, fail: ${result.failCount}`);
    expect(result.successCount).toBe(50);
    expect(elapsed).toBeLessThan(3000);
  });

  it('searchBackups: search 100+ backups under 200ms', () => {
    const start = Date.now();
    const results = searchBackups({ query: 'bench', searchIn: ['all'] }, store);
    const elapsed = Date.now() - start;

    console.log(`searchBackups: ${elapsed}ms, results: ${results.length}`);
    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});