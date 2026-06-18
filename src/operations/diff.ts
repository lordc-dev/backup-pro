import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { backupNotFoundError, validateMetadataPath } from '../utils/validate.js';
import { pathExists, readFile, assertFileSize } from '../utils/fs.js';
import { config } from '../utils/config.js';
import { BackupStore } from '../utils/store.js';
import { diffLines } from '../utils/myers-diff.js';

/** Result of comparing a backup with the current file or another backup. */
export interface DiffResult {
  backupId: string;
  originalPath: string;
  hasChanges: boolean;
  additions: number;
  deletions: number;
  diff: string;
}

function getDiffPrefix(part: { added?: boolean; removed?: boolean }): string {
  if (part.added) return '+';
  if (part.removed) return '-';
  return ' ';
}

function formatDiffPart(part: { added?: boolean; removed?: boolean; value: string }): string[] {
  const lines: string[] = [];
  const prefix = getDiffPrefix(part);

  for (const line of part.value.split('\n')) {
    lines.push(`${prefix}${line}`);
  }

  return lines;
}

function buildDiffHunks(
  changes: Array<{ added?: boolean; removed?: boolean; value: string; count?: number }>,
  backupId: string,
  compareLabel: string
): { hunks: string[]; additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  const hunks: string[] = [];

  hunks.push(`--- backup:${backupId}`, `+++ ${compareLabel}`);

  for (const part of changes) {
    if (part.added) {
      additions += part.count || 0;
    } else if (part.removed) {
      deletions += part.count || 0;
    }

    hunks.push(...formatDiffPart(part));
  }

  return { hunks, additions, deletions };
}

/** Compares a backup's content with the current file or another backup, returning line-level diff. */
export async function diffBackup(
  backupId: string,
  backups: BackupStore,
  compareWithBackupId?: string
): Promise<DiffResult> {
  const backup = backups.get(backupId);
  if (!backup) {
    throw backupNotFoundError(backupId);
  }

  if (!(await pathExists(backup.backupPath))) {
    throw new McpError(ErrorCode.InternalError, `Backup file missing: ${backup.backupPath}`);
  }
  validateMetadataPath(backup.backupPath, `backup ${backupId}`);
  await assertFileSize(backup.backupPath, config.maxDiffSize, 'diff');

  let compareContent: string;
  let compareLabel: string;

  if (compareWithBackupId) {
    const compareBackup = backups.get(compareWithBackupId);
    if (!compareBackup) {
      throw backupNotFoundError(compareWithBackupId);
    }
    if (!(await pathExists(compareBackup.backupPath))) {
      throw new McpError(ErrorCode.InternalError, `Comparison backup file missing: ${compareBackup.backupPath}`);
    }
    validateMetadataPath(compareBackup.backupPath, `backup ${compareWithBackupId}`);
    compareContent = (await readFile(compareBackup.backupPath)).toString('utf-8');
    compareLabel = `backup:${compareWithBackupId}`;
  } else {
    if (!(await pathExists(backup.metadata.originalPath))) {
      throw new McpError(ErrorCode.InvalidParams, `Original file no longer exists: ${backup.metadata.originalPath}`);
    }
    compareContent = (await readFile(backup.metadata.originalPath)).toString('utf-8');
    compareLabel = 'current';
  }

  const backupContent = (await readFile(backup.backupPath)).toString('utf-8');

  const changes = diffLines(backupContent, compareContent);

  const { hunks, additions, deletions } = buildDiffHunks(changes, backupId, compareLabel);

  return {
    backupId,
    originalPath: backup.metadata.originalPath,
    hasChanges: additions > 0 || deletions > 0,
    additions,
    deletions,
    diff: hunks.join('\n') || 'No changes detected'
  };
}