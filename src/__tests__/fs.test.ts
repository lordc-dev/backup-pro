import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import {
  safeReadFile,
  safeCopyFile,
  pathExists,
  remove,
  copy,
  mkdirp,
  ensureDir,
  readJSON,
  writeJSON,
  realpath,
  stat,
  readdir,
} from '../utils/fs.js';

const TMP_DIR = path.join(os.tmpdir(), `fs-test-${Date.now()}`);
const TEST_FILE = path.join(TMP_DIR, 'test.txt');

beforeEach(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('pathExists', () => {
  it('returns true for existing file', async () => {
    await fs.writeFile(TEST_FILE, 'hello');
    expect(await pathExists(TEST_FILE)).toBe(true);
  });

  it('returns false for nonexistent file', async () => {
    expect(await pathExists('/nonexistent/path/file.txt')).toBe(false);
  });

  it('returns true for existing directory', async () => {
    expect(await pathExists(TMP_DIR)).toBe(true);
  });
});

describe('safeReadFile', () => {
  it('reads file content as Buffer', async () => {
    await fs.writeFile(TEST_FILE, 'safe content');
    const content = await safeReadFile(TEST_FILE);
    expect(Buffer.isBuffer(content)).toBe(true);
    expect(content.toString()).toBe('safe content');
  });

  it('throws for nonexistent file', async () => {
    await expect(safeReadFile('/nonexistent/file.txt')).rejects.toThrow();
  });
});

describe('safeCopyFile', () => {
  it('copies file content', async () => {
    await fs.writeFile(TEST_FILE, 'copy me');
    const dest = path.join(TMP_DIR, 'copy.txt');
    await safeCopyFile(TEST_FILE, dest);
    const content = await fs.readFile(dest, 'utf-8');
    expect(content).toBe('copy me');
  });

  it('copies file with preserveTimestamps', async () => {
    await fs.writeFile(TEST_FILE, 'timestamp test');
    const dest = path.join(TMP_DIR, 'copy-ts.txt');
    await safeCopyFile(TEST_FILE, dest, { preserveTimestamps: true });
    const content = await fs.readFile(dest, 'utf-8');
    expect(content).toBe('timestamp test');
  });

  it('throws for nonexistent source', async () => {
    const dest = path.join(TMP_DIR, 'dest.txt');
    await expect(safeCopyFile('/nonexistent/src.txt', dest)).rejects.toThrow();
  });
});

describe('remove', () => {
  it('removes an existing file', async () => {
    const file = path.join(TMP_DIR, 'remove-me.txt');
    await fs.writeFile(file, 'bye');
    await remove(file);
    expect(await pathExists(file)).toBe(false);
  });

  it('does not throw for nonexistent path', async () => {
    await expect(remove('/nonexistent/path/file.txt')).resolves.toBeUndefined();
  });

  it('removes a directory recursively', async () => {
    const dir = path.join(TMP_DIR, 'rmdir');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'file.txt'), 'content');
    await remove(dir);
    expect(await pathExists(dir)).toBe(false);
  });
});

describe('copy', () => {
  it('copies file', async () => {
    await fs.writeFile(TEST_FILE, 'copy test');
    const dest = path.join(TMP_DIR, 'copied.txt');
    await copy(TEST_FILE, dest);
    const content = await fs.readFile(dest, 'utf-8');
    expect(content).toBe('copy test');
  });

  it('copies file with preserveTimestamps', async () => {
    await fs.writeFile(TEST_FILE, 'preserve test');
    const dest = path.join(TMP_DIR, 'preserved.txt');
    await copy(TEST_FILE, dest, { preserveTimestamps: true });
    const content = await fs.readFile(dest, 'utf-8');
    expect(content).toBe('preserve test');
  });
});

describe('mkdirp', () => {
  it('creates nested directories', async () => {
    const dir = path.join(TMP_DIR, 'a', 'b', 'c');
    await mkdirp(dir);
    expect(await pathExists(dir)).toBe(true);
  });

  it('does not throw for existing directory', async () => {
    await mkdirp(TMP_DIR);
    expect(await pathExists(TMP_DIR)).toBe(true);
  });
});

describe('ensureDir', () => {
  it('creates directory', async () => {
    const dir = path.join(TMP_DIR, 'ensured');
    await ensureDir(dir);
    expect(await pathExists(dir)).toBe(true);
  });
});

describe('readJSON', () => {
  it('reads and parses JSON file', async () => {
    const file = path.join(TMP_DIR, 'data.json');
    const data = { name: 'test', value: 42 };
    await fs.writeFile(file, JSON.stringify(data));
    const result = await readJSON(file);
    expect(result).toEqual(data);
  });
});

describe('writeJSON', () => {
  it('writes JSON to file', async () => {
    const file = path.join(TMP_DIR, 'out.json');
    const data = { key: 'value' };
    await writeJSON(file, data);
    const content = await fs.readFile(file, 'utf-8');
    expect(JSON.parse(content)).toEqual(data);
  });

  it('formats with custom spaces', async () => {
    const file = path.join(TMP_DIR, 'formatted.json');
    await writeJSON(file, { a: 1 }, { spaces: 4 });
    const content = await fs.readFile(file, 'utf-8');
    expect(content).toContain('    ');
  });
});

describe('stat', () => {
  it('returns file stats', async () => {
    await fs.writeFile(TEST_FILE, 'stat test');
    const stats = await stat(TEST_FILE);
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
  });
});

describe('readdir', () => {
  it('lists directory contents', async () => {
    await fs.writeFile(path.join(TMP_DIR, 'a.txt'), 'a');
    await fs.writeFile(path.join(TMP_DIR, 'b.txt'), 'b');
    const entries = await readdir(TMP_DIR);
    expect(entries).toContain('a.txt');
    expect(entries).toContain('b.txt');
  });
});

describe('realpath', () => {
  it('resolves real path for existing file', async () => {
    await fs.writeFile(TEST_FILE, 'real path');
    const resolved = await realpath(TEST_FILE);
    expect(resolved).toBeDefined();
    expect(typeof resolved).toBe('string');
  });

  it('returns undefined for nonexistent path', async () => {
    const resolved = await realpath('/nonexistent/path/file.txt');
    expect(resolved).toBeUndefined();
  });
});
