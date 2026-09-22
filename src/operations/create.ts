import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { fileNotFoundError, toMcpError, validateAndResolveFilePath, sanitizePath } from '../utils/validate.js';
import { copyAtomic, ensureDir, stat, hashFile } from '../utils/fs.js';
import * as path from 'node:path';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, CreateBackupParams, CreateBackupResult } from '../types/index.js';
import { generateBackupId, generateBackupFileName } from '../utils/hashing.js';

import { config } from '../utils/config.js';

function validateBackupCount(filePath: string, resolvedPath: string, backups: BackupStore): void {
  if (config.maxBackupsPerFile > 0) {
    const existingCount = [...backups.values()].filter(b => b.metadata.originalPath === resolvedPath).length;
    if (existingCount >= config.maxBackupsPerFile) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Backup limit reached for ${sanitizePath(filePath)}: ${existingCount}/${config.maxBackupsPerFile}. Use cleanup_backups to remove old backups.`
      );
    }
  }
}

function buildBackupInfo(
  resolvedPath: string,
  backupId: string,
  backupPath: string,
  stats: { size: number },
  fileHash: string | undefined,
  params: CreateBackupParams,
  hashWarning: string | undefined
): { backupInfo: BackupInfo; result: CreateBackupResult } {
  const { tags = [], relatedFiles = [], projectContext = '' } = params;
  const desc = params.description || `Backup of ${path.basename(resolvedPath)}`;

  const backupInfo: BackupInfo = {
    backupPath,
    metadata: {
      id: backupId,
      originalPath: resolvedPath,
      timestamp: new Date().toISOString(),
      description: desc,
      size: stats.size,
      tags,
      fileHash,
      relatedFiles,
      projectContext,
    },
  };

  const result: CreateBackupResult = {
    backupId,
    backupPath,
  };

  if (hashWarning) {
    result.warnings = [hashWarning];
  }

  return { backupInfo, result };
}

async function validateFile(filePath: string, resolvedPath: string): Promise<{ size: number }> {
  let stats;
  try {
    stats = await stat(resolvedPath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') throw fileNotFoundError(resolvedPath);
    throw nodeError;
  }
  if (!stats.isFile()) {
    throw new McpError(ErrorCode.InvalidParams, `Path is not a file: ${sanitizePath(resolvedPath)}`);
  }
  if (config.maxFileSize > 0 && stats.size > config.maxFileSize) {
    throw new McpError(ErrorCode.InvalidParams, `File too large: exceeds limit of ${config.maxFileSize} bytes`);
  }
  return stats;
}

function handleBackupError(error: unknown, resolvedPath: string, filePath: string): never {
  if (error instanceof McpError) throw error;
  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError.code === 'ENOENT') throw fileNotFoundError(resolvedPath);
  if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') throw new McpError(ErrorCode.InvalidParams, `Permission denied: ${sanitizePath(filePath)}`);
  if (nodeError.code === 'ENOSPC') throw new McpError(ErrorCode.InternalError, 'No space left on device');
  throw toMcpError(error, 'Error creating backup');
}

/** Creates a backup of a file, copying it to the backup directory with metadata. */
export async function createBackup(
  params: CreateBackupParams,
  backups: BackupStore
): Promise<CreateBackupResult> {
  const { filePath } = params;
  const resolvedPath = await validateAndResolveFilePath(filePath);

  validateBackupCount(filePath, resolvedPath, backups);
  const stats = await validateFile(filePath, resolvedPath);

  const timestamp = new Date().toISOString();
  const backupId = generateBackupId(resolvedPath, timestamp);
  const backupFileName = generateBackupFileName(resolvedPath, backupId, timestamp);
  const backupPath = path.join(config.backupDir, backupFileName);

  let fileHash: string | undefined;
  let hashWarning: string | undefined;

  try {
    await ensureDir(config.backupDir);
    await copyAtomic(resolvedPath, backupPath, { preserveTimestamps: true });
  } catch (error) {
    handleBackupError(error, resolvedPath, filePath);
  }

  // Hash the backup copy (streaming) — no second read of the original.
  // Failure here is a warning, not fatal: the backup file already exists.
  try {
    fileHash = await hashFile(backupPath);
  } catch (error) {
    hashWarning = `Failed to calculate file hash: ${error instanceof Error ? error.message : String(error)}`;
  }

  const { backupInfo, result } = buildBackupInfo(
    resolvedPath, backupId, backupPath, stats, fileHash, params, hashWarning
  );

  backups.set(backupId, backupInfo);

  return result;
}