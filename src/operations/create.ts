import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { fileNotFoundError, toMcpError } from '../utils/validate.js';
import { copy, pathExists, stat, readFile } from '../utils/fs.js';
import * as path from 'node:path';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, CreateBackupParams, CreateBackupResult } from '../types/index.js';
import { BACKUP_DIR } from '../utils/constants.js';
import { generateBackupId, generateBackupFileName, ensureBackupDir, calculateFileHash } from '../utils/hashing.js';

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

  if (!(await pathExists(filePath))) {
    throw fileNotFoundError(filePath);
  }

  const stats = await stat(filePath);
  if (!stats.isFile()) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Path is not a file: ${filePath}`
    );
  }

  await ensureBackupDir();

  const timestamp = new Date().toISOString();
  const backupId = generateBackupId(filePath, timestamp);
  const backupFileName = generateBackupFileName(filePath, backupId, timestamp);
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  let fileHash: string | undefined;
  let hashWarning: string | undefined;

  try {
    await copy(filePath, backupPath, { preserveTimestamps: true });

    try {
      const content = await readFile(filePath);
      fileHash = calculateFileHash(content);
    } catch (error) {
      hashWarning = `Failed to calculate file hash: ${error instanceof Error ? error.message : String(error)}`;
    }

    const desc = description || `Backup of ${path.basename(filePath)}`;
    const backupInfo: BackupInfo = {
      backupPath,
      metadata: {
        id: backupId,
        originalPath: filePath,
        timestamp,
        description: desc,
        size: stats.size,
        tags,
        fileHash,
        relatedFiles,
        projectContext,
        author: process.env.USER || 'unknown',
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