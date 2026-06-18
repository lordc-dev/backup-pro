import { requireString, requireStringArray, optionalString, optionalStringArray, optionalNumber, optionalBoolean, validateFilePath } from '../utils/validate.js';
import { config } from '../utils/config.js';
import { CreateBackupParams, RestoreBackupParams, CleanupBackupsParams, BatchBackupParams } from '../types/index.js';
import { createBackup, restoreBackup, deleteBackup, cleanupBackups, batchBackup, previewBackup, diffBackup, formatBatchResult } from '../operations/index.js';
import { formatFileSize, formatCleanupResult } from '../utils/index.js';
import { ToolDefinition, textResult } from './types.js';

export const createBackupTool: ToolDefinition = {
  name: "create_backup",
  description: "Create a backup of a file with tags and metadata",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Full path to the file to backup" },
      description: { type: "string", description: "Description of the backup" },
      tags: { type: "array", items: { type: "string" }, description: "Tags to categorize the backup" },
      relatedFiles: { type: "array", items: { type: "string" }, description: "Related files (informational)" },
      projectContext: { type: "string", description: "Project context" },
    },
    required: ["filePath"],
  },
  persistAfter: true,
  handler: async (args, backups) => {
    const filePath = requireString(args, 'filePath');
    validateFilePath(filePath);
    const params: CreateBackupParams = { 
      filePath, 
      description: optionalString(args, 'description'),
      tags: optionalStringArray(args, 'tags'),
      relatedFiles: optionalStringArray(args, 'relatedFiles'),
      projectContext: optionalString(args, 'projectContext'),
    };
    const { backupId, backupPath, warnings } = await createBackup(params, backups);
    const tagsDisplay = params.tags && params.tags.length > 0 ? '🏷️  Tags: ' + params.tags.map(t => '#' + t).join(' ') : '';
    const warningLines = (warnings ?? []).map(w => '   • ' + w).join('\n');
    const warningsDisplay = warnings && warnings.length > 0 ? '\n\n⚠️  Warnings:\n' + warningLines : '';
    const msg = `✅ Backup created successfully\n\n📁 File: ${params.filePath}\n🆔 ID: ${backupId}\n📍 Location: ${backupPath}${tagsDisplay}${warningsDisplay}`;
    return textResult(msg);
  },
};

export const restoreBackupTool: ToolDefinition = {
  name: "restore_backup",
  description: "Restore a file from a backup. Optionally restore to a different location.",
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup to restore" },
      targetPath: { type: "string", description: "Optional: restore to this path instead of original location" },
    },
    required: ["backupId"],
  },
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const targetPath = optionalString(args, 'targetPath');
    if (targetPath) validateFilePath(targetPath);
    const params: RestoreBackupParams = { backupId, targetPath };
    const { originalPath, restoredTo } = await restoreBackup(params, backups);
    const restoredToText = params.targetPath ? `\n📍 Restored to: ${restoredTo}` : '';
    return textResult(`✅ File restored successfully\n\n📁 ${originalPath}${restoredToText}\n🆔 From backup: ${params.backupId}`);
  },
};

export const deleteBackupTool: ToolDefinition = {
  name: "delete_backup",
  description: "Delete a specific backup by ID",
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup to delete" },
    },
    required: ["backupId"],
  },
  persistAfter: true,
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const result = await deleteBackup(backupId, backups);
    return textResult(`🗑️  Backup deleted\n\n🆔 ID: ${result.backupId}\n📁 File: ${result.metadata.originalPath}\n💾 Freed: ${formatFileSize(result.freedSpace)}`);
  },
};

export const cleanupBackupsTool: ToolDefinition = {
  name: "cleanup_backups",
  description: "Clean up old or excessive backups",
  inputSchema: {
    type: "object",
    properties: {
      keepLast: { type: "number", description: "Keep last N backups per file" },
      olderThan: { type: "string", description: "Delete older than (e.g., '7d', '24h', '30m')" },
      filePath: { type: "string", description: "Only clean backups of this file" },
      dryRun: { type: "boolean", description: "Only show what would be deleted without actually deleting" },
      excludeTags: { type: "array", items: { type: "string" }, description: "Don't delete backups with these tags" },
    },
  },
  persistAfter: true,
  handler: async (args, backups) => {
    const params: CleanupBackupsParams = { 
      keepLast: optionalNumber(args, 'keepLast'),
      olderThan: optionalString(args, 'olderThan'),
      filePath: optionalString(args, 'filePath'),
      dryRun: optionalBoolean(args, 'dryRun'),
      excludeTags: optionalStringArray(args, 'excludeTags'),
    };
    const result = await cleanupBackups(params, backups);
    return textResult(formatCleanupResult({ deletedCount: result.deletedCount, freedSpace: result.freedSpace, keptCount: result.keptBackups.length }) + (params.dryRun ? '\n\n⚠️  Dry-run mode: nothing was actually deleted' : ''));
  },
};

export const batchBackupTool: ToolDefinition = {
  name: "batch_backup",
  description: "Create backups for multiple files at once with shared tags and description",
  inputSchema: {
    type: "object",
    properties: {
      filePaths: { type: "array", items: { type: "string" }, description: "Array of file paths to backup" },
      description: { type: "string", description: "Shared description for all backups" },
      tags: { type: "array", items: { type: "string" }, description: "Shared tags for all backups" },
      projectContext: { type: "string", description: "Project context" },
    },
    required: ["filePaths"],
  },
  persistAfter: true,
  handler: async (args, backups) => {
    const filePaths = requireStringArray(args, 'filePaths');
    for (const fp of filePaths) validateFilePath(fp);
    const params: BatchBackupParams = { 
      filePaths, 
      description: optionalString(args, 'description'), 
      tags: optionalStringArray(args, 'tags'), 
      projectContext: optionalString(args, 'projectContext'),
    };
    const result = await batchBackup(params, backups);
    return textResult(formatBatchResult(result));
  },
};

export const previewBackupTool: ToolDefinition = {
  name: "preview_backup",
  description: "Preview backup content without restoring. View file contents safely.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup to preview" },
      head: { type: "number", description: "Show first N lines" },
      tail: { type: "number", description: "Show last N lines" },
      maxChars: { type: "number", description: "Maximum characters to return (default: " + config.maxPreviewChars + ")" },
    },
    required: ["backupId"],
  },
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const result = await previewBackup(backupId, backups, {
      head: optionalNumber(args, 'head'),
      tail: optionalNumber(args, 'tail'),
      maxChars: optionalNumber(args, 'maxChars'),
    });
    const tagsStr = result.tags.length > 0 ? '🏷️  Tags: ' + result.tags.map(t => '#' + t).join(' ') + '\n' : '';
    const separator = '═'.repeat(50);
    const dash = '─'.repeat(50);
    const header = '📄 Preview: ' + result.fileName + '\n' + separator + '\n🆔 Backup ID: ' + result.backupId + '\n💾 Size: ' + result.sizeFormatted + ' | Lines: ' + result.totalLines + '\n' + tagsStr + dash + '\n';
    let content = result.content;
    if (result.truncated) content += `\n\n... (truncated, showing ${result.previewLines} of ${result.totalLines} lines)`;
    return textResult(header + content);
  },
};

export const diffBackupTool: ToolDefinition = {
  name: "diff_backup",
  description: "Compare a backup with the current file or another backup. Shows what changed.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup to compare" },
      compareWith: { type: "string", description: "Optional: ID of another backup to compare with (default: compare with current file)" },
    },
    required: ["backupId"],
  },
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const compareWith = optionalString(args, 'compareWith');
    const result = await diffBackup(backupId, backups, compareWith);
    const comparisonLabel = compareWith ? ' vs backup:' + compareWith : ' vs current file';
    const changeSummary = result.hasChanges ? '➕ ' + result.additions + ' additions, ➖ ' + result.deletions + ' deletions' : '✅ No changes';
    const separator = '═'.repeat(50);
    const dash = '─'.repeat(50);
    const header = '📊 Diff: backup:' + backupId + comparisonLabel + '\n' + separator + '\n📁 File: ' + result.originalPath + '\n' + changeSummary + '\n' + dash + '\n';
    return textResult(header + result.diff);
  },
};