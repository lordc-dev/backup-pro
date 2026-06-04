import { promises as fsp } from 'node:fs';
import { log } from './logger.js';

export const readFile = fsp.readFile;

export async function realpath(filePath: string): Promise<string | undefined> {
  try {
    const resolved = await fsp.realpath(filePath);
    return resolved;
  } catch (error) {
    log.debug('fs', 'realpath failed, returning undefined', { path: filePath, error: error instanceof Error ? error.message : String(error) });
    return undefined;
  }
}


async function safeOpenAndVerify(filePath: string): Promise<{ fh: import('node:fs/promises').FileHandle; content: Buffer; stat: import('node:fs').Stats }> {
  const fh = await fsp.open(filePath, 'r');
  try {
    const beforeStat = await fh.stat();
    const content = await fh.readFile();
    const afterStat = await fh.stat();
    if (beforeStat.ino !== afterStat.ino || beforeStat.dev !== afterStat.dev) {
      throw new Error('File identity changed during operation — possible TOCTOU race condition');
    }
    return { fh, content, stat: beforeStat };
  } catch (err) {
    await fh.close();
    throw err;
  }
}

export async function safeReadFile(filePath: string): Promise<Buffer> {
  const { fh, content } = await safeOpenAndVerify(filePath);
  await fh.close();
  return content;
}

export async function safeCopyFile(src: string, dest: string, options?: { preserveTimestamps?: boolean }): Promise<void> {
  const { fh, content, stat: srcStat } = await safeOpenAndVerify(src);
  try {
    await fsp.writeFile(dest, content);
    if (options?.preserveTimestamps) {
      await fsp.utimes(dest, srcStat.atime, srcStat.mtime);
    }
  } finally {
    await fh.close();
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    log.debug('fs', 'pathExists check failed, returning false');
    return false;
  }
}

export const stat = fsp.stat;

export const readdir = fsp.readdir;

export async function remove(filePath: string): Promise<void> {
  try {
    await fsp.rm(filePath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function copy(src: string, dest: string, options?: { preserveTimestamps?: boolean }): Promise<void> {
  try {
    await safeCopyFile(src, dest, options);
  } catch (safeCopyError) {
    if (safeCopyError instanceof Error && safeCopyError.message.includes('TOCTOU')) {
      throw safeCopyError;
    }
    await fsp.cp(src, dest, { recursive: true });
    if (options?.preserveTimestamps) {
      const srcStat = await fsp.stat(src);
      await fsp.utimes(dest, srcStat.atime, srcStat.mtime);
    }
  }
}

export async function mkdirp(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function readJSON<T = unknown>(filePath: string): Promise<T> {
  const content = await fsp.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function writeJSON(filePath: string, data: unknown, options?: { spaces?: number }): Promise<void> {
  const content = JSON.stringify(data, null, options?.spaces ?? 2);
  await fsp.writeFile(filePath, content, 'utf-8');
}