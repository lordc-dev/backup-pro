import { requireString, optionalString, optionalStringArray, optionalNumber, optionalBoolean, validateDateString, validatePositiveNumber } from '../utils/validate.js';
import { ListBackupsParams, SearchBackupsParams } from '../types/index.js';
import { listBackups, searchBackups, getBackup, getBackupStats, findDuplicates, verifyBackup, formatBackupDetails, formatVerifyResult, formatDuplicatesResult, searchBackupContent } from '../operations/index.js';
import { formatBackupList, formatBackupStats } from '../utils/index.js';
import { ToolDefinition, textResult } from './types.js';

export const listBackupsTool: ToolDefinition = {
  name: "list_backups",
  description: "List backups with advanced filtering",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Filter by specific file" },
      tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
      afterDate: { type: "string", description: "Backups after this date (ISO 8601)" },
      beforeDate: { type: "string", description: "Backups before this date (ISO 8601)" },
      searchTerm: { type: "string", description: "Search in description and names" },
      limit: { type: "number", description: "Limit results" },
      sortBy: { type: "string", enum: ["date", "size", "name"], description: "Sort by" },
      sortOrder: { type: "string", enum: ["asc", "desc"], description: "Sort order (default: desc)" },
    },
  },
  handler: async (args, backups) => {
    const params: ListBackupsParams = { 
      filePath: optionalString(args, 'filePath'),
      tags: optionalStringArray(args, 'tags'),
      afterDate: validateDateString(optionalString(args, 'afterDate'), 'afterDate'),
      beforeDate: validateDateString(optionalString(args, 'beforeDate'), 'beforeDate'),
      searchTerm: optionalString(args, 'searchTerm'),
      limit: validatePositiveNumber(optionalNumber(args, 'limit'), 'limit'),
      sortBy: optionalString(args, 'sortBy') as 'date' | 'size' | 'name' | undefined,
      sortOrder: optionalString(args, 'sortOrder') as 'asc' | 'desc' | undefined,
    };
    return textResult(formatBackupList(listBackups(params, backups)));
  },
};

export const searchBackupsTool: ToolDefinition = {
  name: "search_backups",
  description: "Search backups by content",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term" },
      searchIn: { type: "array", items: { type: "string", enum: ["description", "tags", "filename", "all"] }, description: "Where to search" },
      tags: { type: "array", items: { type: "string" }, description: "Filter by additional tags" },
      dateRange: { type: "object", properties: { start: { type: "string" }, end: { type: "string" } }, description: "Date range" },
    },
    required: ["query"],
  },
  handler: async (args, backups) => {
    const query = requireString(args, 'query');
    const searchIn = optionalStringArray(args, 'searchIn') as ('description' | 'tags' | 'filename' | 'all')[] | undefined;
    const tags = optionalStringArray(args, 'tags');
    const dateRangeObj = typeof args === 'object' && args !== null ? (args as Record<string, unknown>).dateRange : undefined;
    const params: SearchBackupsParams = { query, searchIn, tags, dateRange: dateRangeObj as SearchBackupsParams['dateRange'] };
    return textResult(formatBackupList(searchBackups(params, backups)));
  },
};

export const getBackupTool: ToolDefinition = {
  name: "get_backup",
  description: "Get detailed information about a specific backup including status and integrity",
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup" },
    },
    required: ["backupId"],
  },
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const details = await getBackup(backupId, backups);
    return textResult(formatBackupDetails(details));
  },
};

export const getBackupStatsTool: ToolDefinition = {
  name: "get_backup_stats",
  description: "Get backup statistics",
  inputSchema: { type: "object", properties: {} },
  handler: async (_args, backups) => {
    const { stats, warnings } = await getBackupStats(backups);
    let result = formatBackupStats(stats);
    if (warnings.length > 0) {
      result += '\n\n⚠️  Warnings:\n' + warnings.map(w => `   • ${w}`).join('\n');
    }
    return textResult(result);
  },
};

export const verifyBackupTool: ToolDefinition = {
  name: "verify_backup",
  description: "Verify backup integrity by checking file hash. Detects corruption or modifications.",
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup to verify" },
    },
    required: ["backupId"],
  },
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const result = await verifyBackup(backupId, backups);
    return textResult(formatVerifyResult(result));
  },
};

export const findDuplicatesTool: ToolDefinition = {
  name: "find_duplicates",
  description: "Find backups with identical content to identify wasted space",
  inputSchema: { type: "object", properties: {} },
  handler: async (_args, backups) => {
    const result = await findDuplicates(backups);
    return textResult(formatDuplicatesResult(result));
  },
};

export const searchBackupContentTool: ToolDefinition = {
  name: "search_backup_content",
  description: "Search inside backup file contents using ripgrep. Find backups containing specific code or text.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Search pattern (regex supported)" },
      ignoreCase: { type: "boolean", description: "Case insensitive search (default: true)" },
      maxResults: { type: "number", description: "Maximum results to return (default: 50)" },
      contextLines: { type: "number", description: "Lines of context around matches (default: 0)" },
    },
    required: ["pattern"],
  },
  handler: async (args, backups) => {
    const result = await searchBackupContent(
      { pattern: requireString(args, 'pattern'), ignoreCase: optionalBoolean(args, 'ignoreCase'), maxResults: optionalNumber(args, 'maxResults'), contextLines: optionalNumber(args, 'contextLines') },
      backups
    );
    let output = `🔍 Content Search Results\n${'═'.repeat(50)}\nQuery: "${result.query}"\nFound: ${result.totalMatches} matches`;
    if (result.unavailable) {
      output += `\n\n⚠️  Search unavailable: ${result.unavailableReason}`;
      return textResult(output);
    }
    output += `\n${'─'.repeat(50)}\n\n`;
    if (result.matches.length === 0) {
      output += `No matches found in backup contents.`;
    } else {
      for (const match of result.matches) {
        output += `📁 ${match.originalPath}\n   🆔 ${match.backupId} | 📅 ${new Date(match.timestamp).toLocaleDateString()}\n   Line ${match.line}: ${match.content.substring(0, 100)}${match.content.length > 100 ? '...' : ''}\n`;
        if (match.tags.length > 0) output += `   🏷️  ${match.tags.map(t => '#' + t).join(' ')}\n`;
        output += `\n`;
      }
    }
    return textResult(output);
  },
};