import * as path from 'node:path';
import * as os from 'node:os';

// These are now derived from config, but exported for backward compatibility.
// Prefer importing from config.ts for runtime configurability.
export { config } from './config.js';

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), '.mcp-backups');
export const AUTO_SAVE_INTERVAL_MS = Number.parseInt(process.env.AUTO_SAVE_INTERVAL_MS || '30000', 10);
export const DEFAULT_MAX_PREVIEW_CHARS = Number.parseInt(process.env.MAX_PREVIEW_CHARS || '10000', 10);