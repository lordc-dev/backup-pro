
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import * as path from 'node:path';
import { config } from './config.js';
import { HOME_DIR } from './config.js';
import { realpath } from './fs.js';

/** Wraps an unknown error as an MCP InternalError with a descriptive prefix. */
export function toMcpError(error: unknown, prefix: string): McpError {
  return new McpError(
    ErrorCode.InternalError,
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`
  );
}

/** Creates an MCP error for a missing source file. */
export function fileNotFoundError(filePath: string): McpError {
  return new McpError(ErrorCode.InvalidParams, `Source file not found: ${sanitizePath(filePath)}`);
}

/** Extracts and validates a required string parameter from an arguments object. */
export function requireString(args: unknown, key: string): string {
  if (typeof args !== 'object' || args === null) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: expected object`);
  }
  const obj = args as Record<string, unknown>;
  if (typeof obj[key] !== 'string' || obj[key].length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `Missing or invalid required parameter: ${key}`);
  }
  return obj[key];
}

/** Extracts an optional string parameter from an arguments object. */
export function optionalString(args: unknown, key: string): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const obj = args as Record<string, unknown>;
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, `Invalid parameter: ${key} must be a string`);
  }
  return val;
}

/** Extracts an optional string array parameter from an arguments object. */
export function optionalStringArray(args: unknown, key: string): string[] | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const obj = args as Record<string, unknown>;
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val) || val.some(v => typeof v !== 'string')) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid parameter: ${key} must be an array of strings`);
  }
  return val;
}

/** Extracts an optional number parameter from an arguments object. */
export function optionalNumber(args: unknown, key: string): number | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const obj = args as Record<string, unknown>;
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'number') {
    throw new McpError(ErrorCode.InvalidParams, `Invalid parameter: ${key} must be a number`);
  }
  return val;
}

/** Extracts an optional boolean parameter from an arguments object. */
export function optionalBoolean(args: unknown, key: string): boolean | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const obj = args as Record<string, unknown>;
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') {
    throw new McpError(ErrorCode.InvalidParams, `Invalid parameter: ${key} must be a boolean`);
  }
  return val;
}

function resolvePath(p: string): string {
  if (p.startsWith('~/')) {
    return HOME_DIR + p.substring(1);
  }
  return p;
}

/** Validates a file path for path traversal and allowed-root restrictions.
 *  If BACKUP_ALLOWED_ROOTS is not set, defaults to the current working directory
 *  to prevent accidental exposure of the entire filesystem. */
export function validateFilePath(filePath: string): void {
  const resolved = resolvePath(filePath);
  const normalized = normalizePath(resolved);

  if (normalized !== resolved.replace(/\/+/g, '/').replace(/\/$/, '')) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid file path: path traversal not allowed');
  }

  if (!config.allowedRoots.some(root => normalized.startsWith(root))) {
    throw new McpError(ErrorCode.InvalidParams, `Access denied: path outside allowed roots`);
  }
}

/** Validates a file path and then resolves symlinks, re-validating the real path against allowed roots.
 *  If BACKUP_ALLOWED_ROOTS is not set, defaults to the current working directory
 *  to prevent accidental exposure of the entire filesystem. */
export async function validateAndResolveFilePath(filePath: string): Promise<string> {
  validateFilePath(filePath);

  const resolved = await realpath(filePath);
  if (!resolved) {
    return resolvePath(filePath);
  }

  const normalizedReal = normalizePath(resolved);

  if (!config.allowedRoots.some(root => normalizedReal.startsWith(root))) {
    throw new McpError(ErrorCode.InvalidParams, `Access denied: resolved path outside allowed roots`);
  }

  return resolved;
}

function normalizePath(p: string): string {
  const isAbsolute = p.startsWith('/');
  const segments = p.split('/').reduce<string[]>((acc, seg) => {
    if (seg === '..') acc.pop();
    else if (seg !== '.' && seg !== '') acc.push(seg);
    return acc;
  }, []);
  return (isAbsolute ? '/' : '') + segments.join('/');
}

/** Sanitizes a file path for error messages, showing only the basename
 *  to prevent information disclosure in production. */
export function sanitizePath(filePath: string): string {
  const basename = path.basename(filePath);
  const dir = path.dirname(filePath);
  if (dir === '/' || dir === '.') return basename;
  const parentDir = path.basename(dir);
  return parentDir ? `${parentDir}/${basename}` : basename;
}

/** Creates an MCP error for a missing backup. */
export function backupNotFoundError(backupId: string): McpError {
  return new McpError(ErrorCode.InvalidParams, `Backup not found: ${backupId}`);
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Validates an ISO 8601 date string parameter, returning undefined if absent. */
export function validateDateString(value: string | undefined, paramName: string): string | undefined {
  if (value === undefined) return undefined;
  if (!ISO_DATE_REGEX.test(value)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${paramName}: must be ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z"), got "${value}"`);
  }
  return value;
}

/** Validates a positive integer parameter with an optional minimum. Returns undefined if absent. */
export function validatePositiveNumber(value: number | undefined, paramName: string, min = 1): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${paramName}: must be an integer >= ${min}, got ${value}`);
  }
  return value;
}