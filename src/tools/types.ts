import { BackupStore } from '../utils/store.js';

export type ToolHandler = (args: unknown, backups: BackupStore) => Promise<{ type: "text"; text: string }>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
  persistAfter?: boolean;
  readOnly?: boolean;
}

export function textResult(text: string): { type: "text"; text: string } {
  return { type: "text" as const, text };
}