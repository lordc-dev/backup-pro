import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { copyAtomic, pathExists, mkdirp } from '../utils/fs.js';
import * as path from 'node:path';
import { RestoreBackupParams } from '../types/index.js';
import {
  validateAndResolveFilePath,
  validateMetadataPath,
  backupNotFoundError,
  toMcpError,
  sanitizePath,
} from '../utils/validate.js';
import { BackupStore } from '../utils/store.js';

/** Restores a file from a backup, optionally to a different target path. */
export async function restoreBackup(
  params: RestoreBackupParams,
  backups: BackupStore
): Promise<{ originalPath: string; restoredTo: string; success: boolean }> {
  const { backupId, targetPath } = params;

  const resolvedTargetPath = targetPath
    ? await validateAndResolveFilePath(targetPath)
    : undefined;

  const backupInfo = backups.get(backupId);
  if (!backupInfo) {
    throw backupNotFoundError(backupId);
  }

  const { metadata: { originalPath }, backupPath } = backupInfo;

  if (!(await pathExists(backupPath))) {
    throw new McpError(
      ErrorCode.InternalError,
      `Backup file missing: ${sanitizePath(backupPath)}`
    );
  }
  validateMetadataPath(backupPath, `backup ${backupId}`);

  const resolvedOriginal = await validateAndResolveFilePath(originalPath);

  const restoreTo = resolvedTargetPath || resolvedOriginal;

  try {
    const dir = path.dirname(restoreTo);
    if (!(await pathExists(dir))) {
      await mkdirp(dir);
    }

    // Atomic copy: writes to a temp file then renames into place.
    // No prior remove needed — rename overwrites the destination atomically.
    await copyAtomic(backupPath, restoreTo, { preserveTimestamps: true });

    return {
      originalPath,
      restoredTo: restoreTo,
      success: true,
    };
  } catch (error) {
    throw toMcpError(error, 'Failed to restore backup');
  }
}