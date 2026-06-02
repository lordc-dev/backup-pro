import { ToolDefinition } from './types.js';
import { createBackupTool, restoreBackupTool, deleteBackupTool, cleanupBackupsTool, batchBackupTool, previewBackupTool, diffBackupTool } from './backup-tools.js';
import { listBackupsTool, searchBackupsTool, getBackupTool, getBackupStatsTool, verifyBackupTool, findDuplicatesTool, searchBackupContentTool } from './query-tools.js';
import { listTagsTool, addTagsTool, removeTagsTool } from './tag-tools.js';

export type { ToolHandler, ToolDefinition } from './types.js';
export { textResult } from './types.js';

export const allTools: ToolDefinition[] = [
  createBackupTool,
  restoreBackupTool,
  listBackupsTool,
  searchBackupsTool,
  getBackupTool,
  diffBackupTool,
  previewBackupTool,
  deleteBackupTool,
  cleanupBackupsTool,
  getBackupStatsTool,
  listTagsTool,
  addTagsTool,
  removeTagsTool,
  verifyBackupTool,
  batchBackupTool,
  findDuplicatesTool,
  searchBackupContentTool,
];