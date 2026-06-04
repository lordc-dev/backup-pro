import { promises as fsp } from 'node:fs';

export const readFile = fsp.readFile;

/** Resolves symlinks and normalizes the path. Returns undefined if the path does not exist. */
export async function realpath(filePath: string): Promise<string | undefined> {
  try {
    const resolved = await fsp.realpath(filePath);
    return resolved;
  } catch {
    return undefined;
  }
}

/** Resolves symlinks and validates the real path stays within allowed roots.
 *  Returns the resolved path, or throws if the path doesn't exist or is outside roots. */
export async function resolveAndValidatePath(filePath: string, allowedRoots: string[]): Promise<string> {
  const resolved = await realpath(filePath);
  if (!resolved) {
    throw new Error(`Path does not exist: ${filePath}`);
  }
  if (allowedRoots.length > 0) {
    const isAllowed = allowedRoots.some(root => resolved.startsWith(root));
    if (!isAllowed) {
      throw new Error(`Access denied: path outside allowed roots`);
    }
  }
  return resolved;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
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
  await fsp.cp(src, dest, {
    recursive: true,
    mode: 0 as unknown as number,
    ...(options?.preserveTimestamps ? {} : {}),
  });
  if (options?.preserveTimestamps) {
    const stats = await fsp.stat(src);
    await fsp.utimes(dest, stats.atime, stats.mtime);
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