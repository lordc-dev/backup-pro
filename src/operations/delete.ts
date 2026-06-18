import { backupNotFoundError, toMcpError, validateMetadataPath } from '../utils/validate.js';
import { pathExists, remove, stat } from '../utils/fs.js';
import { BackupStore } from '../utils/store.js';
import { BackupMetadata } from '../types/index.js';
import { log } from '../utils/logger.js';

/** Result of deleting a single backup. */
export interface DeleteResult {
  success: boolean;
  backupId: string;
  freedSpace: number;
  metadata: BackupMetadata;
}

/** Deletes a single backup by ID, removing its file and metadata. */
export async function deleteBackup(
  backupId: string,
  backups: BackupStore
): Promise<DeleteResult> {
  const backup = backups.get(backupId);
  if (!backup) {
    throw backupNotFoundError(backupId);
  }

  let freedSpace = 0;

  if (await pathExists(backup.backupPath)) {
    validateMetadataPath(backup.backupPath, `backup ${backupId}`);
    try {
      const stats = await stat(backup.backupPath);
      freedSpace = stats.size;
    } catch (error) {
      log.warn('delete', `Error getting file size, using 0`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const metadata = { ...backup.metadata };

  try {
    if (await pathExists(backup.backupPath)) {
      await remove(backup.backupPath);
    }
  } catch (error) {
    throw toMcpError(error, 'Failed to delete backup file');
  }

  backups.delete(backupId);

  return {
    success: true,
    backupId,
    freedSpace,
    metadata
  };
}

/** Deletes multiple backups by ID, collecting successes and failures. */
export async function deleteBackups(
  backupIds: string[],
  backups: BackupStore
): Promise<{ deleted: DeleteResult[]; failed: { id: string; error: string }[] }> {
  const deleted: DeleteResult[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of backupIds) {
    try {
      const result = await deleteBackup(id, backups);
      deleted.push(result);
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { deleted, failed };
}