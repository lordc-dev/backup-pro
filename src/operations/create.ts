import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { fileNotFoundError, toMcpError, validateAndResolveFilePath } from '../utils/validate.js';
import { copy, pathExists, stat, readFile } from '../utils/fs.js';
import * as path from 'node:path';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, CreateBackupParams, CreateBackupResult } from '../types/index.js';
import { BACKUP_DIR } from '../utils/constants.js';
import { generateBackupId, generateBackupFileName, ensureBackupDir, calculateFileHash } from '../utils/hashing.js';

import { config } from '../utils/config.js';

/** Creates a backup of a file, copying it to the backup directory with metadata. */
export async function createBackup(
  params: CreateBackupParams,
  backups: BackupStore
): Promise<CreateBackupResult> {
  const { 
    filePath, 
    description = '', 
    tags = [],
    relatedFiles = [],
    projectContext = ''
  } = params;

  const resolvedPath = await validateAndResolveFilePath(filePath);

  if (config.maxBackupsPerFile > 0) {
    const existingCount = [...backups.values()].filter(b => b.metadata.originalPath === resolvedPath).length;
    if (existingCount >= config.maxBackupsPerFile) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Backup limit reached for ${filePath}: ${existingCount}/${config.maxBackupsPerFile}. Use cleanup_backups to remove old backups.`
      );
    }
  }

  if (config.maxFileSize > 0) {
    const sizeCheck = await stat(resolvedPath);
    if (sizeCheck.size > config.maxFileSize) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `File too large: ${sizeCheck.size} bytes exceeds limit of ${config.maxFileSize} bytes`
      );
    }
  }

  if (!(await pathExists(resolvedPath))) {
    throw fileNotFoundError(resolvedPath);
  }

  const stats = await stat(resolvedPath);
  if (!stats.isFile()) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Path is not a file: ${resolvedPath}`
    );
  }
  // SECURITY: resolvedPath was validated via realpath() in validateAndResolveFilePath(),
  // preventing symlink-based path traversal. The TOCTOU window between realpath() and
  // copy() is mitigated by BACKUP_ALLOWED_ROOTS enforcement on the resolved path.

  await ensureBackupDir();

  const timestamp = new Date().toISOString();
  const backupId = generateBackupId(resolvedPath, timestamp);
  const backupFileName = generateBackupFileName(resolvedPath, backupId, timestamp);
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  let fileHash: string | undefined;
  let hashWarning: string | undefined;

  try {
    await copy(resolvedPath, backupPath, { preserveTimestamps: true });

    try {
      const content = await readFile(resolvedPath);
      fileHash = calculateFileHash(content);
    } catch (error) {
      hashWarning = `Failed to calculate file hash: ${error instanceof Error ? error.message : String(error)}`;
    }

    const desc = description || `Backup of ${path.basename(resolvedPath)}`;
    const backupInfo: BackupInfo = {
      backupPath,
      metadata: {
        id: backupId,
        originalPath: resolvedPath,
        timestamp,
        description: desc,
        size: stats.size,
        tags,
        fileHash,
        relatedFiles,
        projectContext,
        author: undefined,
      },
    };

    backups.set(backupId, backupInfo);

    const result: { backupId: string; backupPath: string; warnings?: string[] } = {
      backupId,
      backupPath
    };

    if (hashWarning) {
      result.warnings = [hashWarning];
    }

    return result;
  } catch (error) {
    throw toMcpError(error, 'Error creating backup');
  }
}
