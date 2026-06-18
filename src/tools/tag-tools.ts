import { requireString, requireStringArray, backupNotFoundError } from '../utils/validate.js';
import { addTagsToBackup, removeTagsFromBackup, getTags } from '../operations/index.js';
import { formatTagList } from '../utils/index.js';
import { ToolDefinition, textResult } from './types.js';

export const listTagsTool: ToolDefinition = {
  name: "list_tags",
  description: "List all available tags",
  inputSchema: { type: "object", properties: {} },
  handler: async (_args, backups) => {
    return textResult(formatTagList(getTags(backups)));
  },
};

export const addTagsTool: ToolDefinition = {
  name: "add_tags",
  description: "Add tags to an existing backup",
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup" },
      tags: { type: "array", items: { type: "string" }, description: "Tags to add" },
    },
    required: ["backupId", "tags"],
  },
  persistAfter: true,
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const tags = requireStringArray(args, 'tags');
    const success = addTagsToBackup(backupId, tags, backups);
    if (!success) throw backupNotFoundError(backupId);
    return textResult(`✅ Tags added to backup ${backupId}\n🏷️  ${tags.map(t => '#' + t).join(' ')}`);
  },
};

export const removeTagsTool: ToolDefinition = {
  name: "remove_tags",
  description: "Remove tags from an existing backup",
  inputSchema: {
    type: "object",
    properties: {
      backupId: { type: "string", description: "ID of the backup" },
      tags: { type: "array", items: { type: "string" }, description: "Tags to remove" },
    },
    required: ["backupId", "tags"],
  },
  persistAfter: true,
  handler: async (args, backups) => {
    const backupId = requireString(args, 'backupId');
    const tags = requireStringArray(args, 'tags');
    const success = removeTagsFromBackup(backupId, tags, backups);
    if (!success) throw backupNotFoundError(backupId);
    return textResult(`✅ Tags removed from backup ${backupId}\n🏷️  Removed: ${tags.map(t => '#' + t).join(' ')}`);
  },
};