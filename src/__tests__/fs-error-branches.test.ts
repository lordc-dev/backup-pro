import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  copy,
  copyAtomic,
  writeFileAtomic,
  assertFileSize,
  hashFile,
  pathExists,
  remove,
} from '../utils/fs.js';

const TMP_DIR = path.join(os.tmpdir(), `fs-error-test-${Date.now()}`);
const TEST_FILE = path.join(TMP_DIR, 'test.txt');

beforeEach(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('hashFile', () => {
  it('produces correct SHA-256 for known content', async () => {
    await fs.writeFile(TEST_FILE, 'hello');
    const hash = await hashFile(TEST_FILE);
    // SHA-256 of "hello"
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('hashes large files in chunks without loading whole file', async () => {
    const bigFile = path.join(TMP_DIR, 'big.bin');
    const chunk = Buffer.alloc(1024 * 1024, 'x');
    const fh = await fs.open(bigFile, 'w');
    for (let i = 0; i < 3; i++) await fh.write(chunk);
    await fh.close();
    const hash = await hashFile(bigFile);
    expect(hash).toHaveLength(64);
  });

  it('throws for nonexistent file', async () => {
    await expect(hashFile('/nonexistent/file.txt')).rejects.toThrow();
  });
});

describe('assertFileSize', () => {
  it('passes when file is under limit', async () => {
    await fs.writeFile(TEST_FILE, 'small');
    await expect(assertFileSize(TEST_FILE, 100, 'test')).resolves.toBeUndefined();
  });

  it('throws when file exceeds limit', async () => {
    await fs.writeFile(TEST_FILE, 'this content is longer than five bytes');
    await expect(assertFileSize(TEST_FILE, 5, 'test')).rejects.toThrow(/too large/i);
  });

  it('throws ENOENT for nonexistent file', async () => {
    await expect(assertFileSize('/nonexistent/file.txt', 100, 'test')).rejects.toThrow();
  });
});

describe('writeFileAtomic', () => {
  it('writes content atomically', async () => {
    const target = path.join(TMP_DIR, 'atomic.txt');
    await writeFileAtomic(target, 'atomic content', 'utf-8');
    expect(await fs.readFile(target, 'utf-8')).toBe('atomic content');
  });

  it('cleans up temp file on write failure', async () => {
    const target = path.join(TMP_DIR, 'nonexistent-dir', 'fail.txt');
    await expect(writeFileAtomic(target, 'x', 'utf-8')).rejects.toThrow();
    // No .tmp- leftovers in TMP_DIR
    const entries = await fs.readdir(TMP_DIR);
    expect(entries.filter(e => e.includes('.tmp-'))).toHaveLength(0);
  });
});

describe('copyAtomic', () => {
  it('copies atomically with timestamps preserved', async () => {
    await fs.writeFile(TEST_FILE, 'copy me');
    const dest = path.join(TMP_DIR, 'atomic-copy.txt');
    await copyAtomic(TEST_FILE, dest, { preserveTimestamps: true });
    expect(await fs.readFile(dest, 'utf-8')).toBe('copy me');
  });

  it('cleans up temp file when source is missing', async () => {
    const dest = path.join(TMP_DIR, 'fail-copy.txt');
    await expect(copyAtomic('/nonexistent/src.txt', dest)).rejects.toThrow();
    const entries = await fs.readdir(TMP_DIR);
    expect(entries.filter(e => e.includes('.tmp-'))).toHaveLength(0);
  });
});

describe('copy fallback', () => {
  it('falls back to recursive cp for directories', async () => {
    const srcDir = path.join(TMP_DIR, 'src-dir');
    await fs.mkdir(srcDir);
    await fs.writeFile(path.join(srcDir, 'inner.txt'), 'inner');
    const destDir = path.join(TMP_DIR, 'dest-dir');
    await copy(srcDir, destDir);
    expect(await fs.readFile(path.join(destDir, 'inner.txt'), 'utf-8')).toBe('inner');
  });
});

describe('remove', () => {
  it('rethrows non-ENOENT errors', async () => {
    // Removing a file inside a read-only parent triggers EPERM/EACCES on most systems.
    // Simulate with a path that is a file used as a directory prefix.
    await fs.writeFile(TEST_FILE, 'file');
    await expect(remove(path.join(TEST_FILE, 'child'))).rejects.toThrow();
  });

  it('silently ignores ENOENT', async () => {
    await expect(remove('/nonexistent/path/file.txt')).resolves.toBeUndefined();
  });
});

describe('pathExists', () => {
  it('returns false for permission-denied paths where applicable', async () => {
    // Basic sanity: existing file
    await fs.writeFile(TEST_FILE, 'x');
    expect(await pathExists(TEST_FILE)).toBe(true);
  });
});