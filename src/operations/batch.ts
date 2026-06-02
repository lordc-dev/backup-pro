import { CreateBackupParams, BatchBackupParams } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { createBackup } from './create.js';
import { parallelMap } from '../utils/concurrency.js';

/** Result of a batch backup operation, listing successes and failures. */
export interface BatchBackupResult {
  successful: { filePath: string; backupId: string }[];
  failed: { filePath: string; error: string }[];
  totalFiles: number;
  successCount: number;
  failCount: number;
}

/**
 * Create backups for multiple files at once with shared metadata
 */
export async function batchBackup(
  params: BatchBackupParams,
  backups: BackupStore
): Promise<BatchBackupResult> {
  const { filePaths, description, tags = [], projectContext } = params;

  const results = await parallelMap(
    filePaths,
    async (filePath) => {
      const createParams: CreateBackupParams = {
        filePath,
        description: description || `Batch backup`,
        tags: [...tags, 'batch'],
        projectContext
      };
      return createBackup(createParams, backups);
    },
    5
  );

  const successful: { filePath: string; backupId: string }[] = [];
  const failed: { filePath: string; error: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      successful.push({ filePath: filePaths[i], backupId: result.value.backupId });
    } else {
      failed.push({
        filePath: filePaths[i],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  }

  return {
    successful,
    failed,
    totalFiles: filePaths.length,
    successCount: successful.length,
    failCount: failed.length
  };
}

/**
 * Format batch backup result for display
 */
export function formatBatchResult(result: BatchBackupResult): string {
  const lines: string[] = [];

  lines.push(`📦 Batch Backup Complete`);
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`📊 Results: ${result.successCount}/${result.totalFiles} successful`);

  if (result.successful.length > 0) {
    lines.push('');
    lines.push('✅ Backed up:');
    for (const { filePath, backupId } of result.successful) {
      lines.push(`   • ${filePath}`);
      lines.push(`     ID: ${backupId}`);
    }
  }

  if (result.failed.length > 0) {
    lines.push('');
    lines.push('❌ Failed:');
    for (const { filePath, error } of result.failed) {
      lines.push(`   • ${filePath}`);
      lines.push(`     Error: ${error}`);
    }
  }

  return lines.join('\n');
}
