import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { backupNotFoundError, validateMetadataPath } from '../utils/validate.js';
import { config } from '../utils/config.js';
import { pathExists, stat, readFile, assertFileSize } from '../utils/fs.js';
import * as path from 'node:path';
import { BackupStore } from '../utils/store.js';
import { formatFileSize } from '../utils/formatting.js';

/** Maximum file size for preview (50 MB) — prevents loading huge files into memory
 *  even before the maxChars cap applies. */
const MAX_PREVIEW_FILE_SIZE = 50 * 1024 * 1024;

/** Result of previewing a backup's file content. */
export interface PreviewResult {
  backupId: string;
  originalPath: string;
  fileName: string;
  size: number;
  sizeFormatted: string;
  totalLines: number;
  previewLines: number;
  content: string;
  truncated: boolean;
  timestamp: string;
  tags: string[];
}

/** Previews a backup's file content with optional head/tail/size limits. */
export async function previewBackup(
  backupId: string,
  backups: BackupStore,
  options: { head?: number; tail?: number; maxChars?: number } = {}
): Promise<PreviewResult> {
  const maxCharsCap = 100_000;
  const { head, tail, maxChars: rawMaxChars = config.maxPreviewChars } = options;
  const maxChars = Math.min(rawMaxChars, maxCharsCap);

  const backup = backups.get(backupId);
  if (!backup) {
    throw backupNotFoundError(backupId);
  }

  if (!(await pathExists(backup.backupPath))) {
    throw new McpError(ErrorCode.InternalError, `Backup file missing: ${backup.backupPath}`);
  }

  validateMetadataPath(backup.backupPath, `backup ${backupId}`);
  await assertFileSize(backup.backupPath, MAX_PREVIEW_FILE_SIZE, 'preview');

  const stats = await stat(backup.backupPath);
  const fullContent = (await readFile(backup.backupPath)).toString('utf-8');
  const allLines = fullContent.split('\n');
  const totalLines = allLines.length;

  let content: string;
  let previewLines: number;
  let truncated = false;

  if (head !== undefined && head > 0) {
    const selectedLines = allLines.slice(0, head);
    content = selectedLines.join('\n');
    previewLines = selectedLines.length;
    truncated = head < totalLines;
  } else if (tail !== undefined && tail > 0) {
    const selectedLines = allLines.slice(-tail);
    content = selectedLines.join('\n');
    previewLines = selectedLines.length;
    truncated = tail < totalLines;
  } else {
    content = fullContent;
    previewLines = totalLines;

  }

  if (content.length > maxChars) {
    content = content.substring(0, maxChars);
    truncated = true;
  }

  return {
    backupId,
    originalPath: backup.metadata.originalPath,
    fileName: path.basename(backup.metadata.originalPath),
    size: stats.size,
    sizeFormatted: formatFileSize(stats.size),
    totalLines,
    previewLines,
    content,
    truncated,
    timestamp: backup.metadata.timestamp,
    tags: backup.metadata.tags || []
  };
}