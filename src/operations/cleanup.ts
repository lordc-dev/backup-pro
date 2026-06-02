import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { CleanupBackupsParams, CleanupResult, BackupInfo } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { log } from '../utils/logger.js';
import { pathExists, remove, stat } from '../utils/fs.js';

/** Removes old or excessive backups based on age, count, or file path, with optional dry-run. */
export async function cleanupBackups(
  params: CleanupBackupsParams,
  backups: BackupStore
): Promise<CleanupResult> {
  const { 
    keepLast,
    olderThan, 
    filePath,
    dryRun = false,
    excludeTags = []
  } = params;

  if (keepLast === undefined && !olderThan && !filePath) {
    throw new McpError(ErrorCode.InvalidParams, 'At least one of keepLast, olderThan, or filePath must be specified');
  }

  const deletedBackups: BackupInfo[] = [];
  const keptBackups: BackupInfo[] = [];
  let freedSpace = 0;

  const groupedByFile = new Map<string, BackupInfo[]>();
  
  for (const [_id, backup] of backups.entries()) {
    if (filePath && backup.metadata.originalPath !== filePath) {
      keptBackups.push(backup);
      continue;
    }

    if (excludeTags.length > 0 && backup.metadata.tags.some(tag => excludeTags.includes(tag))) {
      keptBackups.push(backup);
      continue;
    }

    const key = backup.metadata.originalPath;
    if (!groupedByFile.has(key)) {
      groupedByFile.set(key, []);
    }
    groupedByFile.get(key)!.push(backup);
  }

  for (const [_file, fileBackups] of groupedByFile.entries()) {
    fileBackups.sort((a, b) => 
      new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
    );

    for (let i = 0; i < fileBackups.length; i++) {
      const backup = fileBackups[i];
      let shouldDelete = false;

      if (keepLast !== undefined && i >= keepLast) {
        shouldDelete = true;
      }

      if (olderThan && !shouldDelete) {
        const cutoffDate = new Date();
        const match = olderThan.match(/^(\d+)([dhm])$/);
        if (!match) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid olderThan format: '${olderThan}'. Use format like '7d', '24h', or '30m'.`);
        }
        
        const amount = Number.parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
          case 'd':
            cutoffDate.setDate(cutoffDate.getDate() - amount);
            break;
          case 'h':
            cutoffDate.setHours(cutoffDate.getHours() - amount);
            break;
          case 'm':
            cutoffDate.setMinutes(cutoffDate.getMinutes() - amount);
            break;
        }
        
        if (new Date(backup.metadata.timestamp) < cutoffDate) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        deletedBackups.push(backup);
        
        if (await pathExists(backup.backupPath)) {
          try {
            const stats = await stat(backup.backupPath);
            freedSpace += stats.size;
          } catch {
            // Size unknown, still proceed with deletion
          }
        }
      } else {
        keptBackups.push(backup);
      }
    }
  }

  if (!dryRun) {
    for (const backup of deletedBackups) {
      backups.delete(backup.metadata.id);

      try {
        if (await pathExists(backup.backupPath)) {
          await remove(backup.backupPath);
        }
      } catch (error) {
        log.error('cleanup', `Error deleting file ${backup.backupPath}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return {
    deletedCount: deletedBackups.length,
    freedSpace: freedSpace,
    deletedBackups: deletedBackups.map(b => b.metadata),
    keptBackups: keptBackups.map(b => b.metadata)
  };
}