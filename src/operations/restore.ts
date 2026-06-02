import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { copy, pathExists, remove, mkdirp } from '../utils/fs.js';
import * as path from 'node:path';
import { RestoreBackupParams } from '../types/index.js';
import { validateFilePath, backupNotFoundError, toMcpError } from '../utils/validate.js';
import { BackupStore } from '../utils/store.js';

/** Restores a file from a backup, optionally to a different target path. */
export async function restoreBackup(
  params: RestoreBackupParams,
  backups: BackupStore
): Promise<{ originalPath: string; restoredTo: string; success: boolean }> {
  const { backupId, targetPath } = params;

  if (targetPath) {
    validateFilePath(targetPath);
  }

  const backupInfo = backups.get(backupId);
  if (!backupInfo) {
    throw backupNotFoundError(backupId);
  }

  const { metadata: { originalPath }, backupPath } = backupInfo;

  validateFilePath(originalPath);

  if (!(await pathExists(backupPath))) {
    throw new McpError(
      ErrorCode.InternalError,
      `Backup file missing: ${backupPath}`
    );
  }

  const restoreTo = targetPath || originalPath;

  try {
    const dir = path.dirname(restoreTo);
    if (!(await pathExists(dir))) {
      await mkdirp(dir);
    }

    if (targetPath && (await pathExists(targetPath))) {
      await remove(targetPath);
    }

    await copy(backupPath, restoreTo, { preserveTimestamps: true });

    if (!targetPath && (await pathExists(originalPath))) {
      try {
        await remove(originalPath);
      } catch {
        // Original still exists after successful restore — non-critical
      }
    }

    return { 
      originalPath, 
      restoredTo: restoreTo,
      success: true 
    };
  } catch (error) {
    throw toMcpError(error, 'Failed to restore backup');
  }
}