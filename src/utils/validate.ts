
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import * as path from 'node:path';
import { config, HOME_DIR } from './config.js';
import { realpath } from './fs.js';
import { log } from './logger.js';

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

/** Extracts and validates a required non-empty string array parameter from an arguments object. */
export function requireStringArray(args: unknown, key: string): string[] {
  const val = optionalStringArray(args, key);
  if (val === undefined || val.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `Missing or invalid required parameter: ${key} must be a non-empty array of strings`);
  }
  return val;
}

/** Validates that a string value is one of an allowed set (enum). */
export function validateEnum(value: string | undefined, allowed: readonly string[], paramName: string): string | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${paramName}: must be one of ${allowed.join(', ')}, got "${value}"`);
  }
  return value;
}

/** Extracts an optional object with `start`/`end` ISO-8601 date string fields. */
export function validateDateStringRecord(args: unknown, key: string): { start?: string; end?: string } | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const obj = args as Record<string, unknown>;
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'object' || val === null) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid parameter: ${key} must be an object with optional start/end date strings`);
  }
  const rec = val as Record<string, unknown>;
  const start = validateDateString(typeof rec.start === 'string' ? rec.start : undefined, `${key}.start`);
  const end = validateDateString(typeof rec.end === 'string' ? rec.end : undefined, `${key}.end`);
  return { ...(start !== undefined && { start }), ...(end !== undefined && { end }) };
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

  if (config.isUnrestricted) return;
  if (config.allowedRoots.length > 0 && !config.allowedRoots.some(root => normalized.startsWith(root))) {
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

  if (config.isUnrestricted) return resolved;
  if (config.allowedRoots.length > 0 && !config.allowedRoots.some(root => normalizedReal.startsWith(root))) {
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

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PREFIX_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const FRACTION_REGEX = /^\.\d+/;
const TIMEZONE_REGEX = /^(Z|[+-]\d{2}:?\d{2})$/;

function isISODateString(value: string): boolean {
  if (DATE_ONLY_REGEX.test(value)) return true;
  if (!DATE_TIME_PREFIX_REGEX.test(value)) return false;

  let rest = value.replace(DATE_TIME_PREFIX_REGEX, '');
  if (rest === '') return true;

  if (rest.startsWith('.')) {
    const fracMatch = FRACTION_REGEX.exec(rest);
    if (!fracMatch) return false;
    rest = rest.slice(fracMatch[0].length);
    if (rest === '') return true;
  }

  return TIMEZONE_REGEX.test(rest);
}

/** Validates an ISO 8601 date string parameter, returning undefined if absent. */
export function validateDateString(value: string | undefined, paramName: string): string | undefined {
  if (value === undefined) return undefined;
  if (!isISODateString(value)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${paramName}: must be ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z"), got "${value}"`);
  }
  return value;
}

/** Re-validates a path loaded from persisted metadata against allowed roots.
 *  Prevents tampered metadata from directing fs operations outside allowed roots.
 *  Unlike validateFilePath, this does NOT expand `~/` (metadata stores absolute paths)
 *  and logs a security warning on rejection. */
export function validateMetadataPath(storedPath: string, context: string): void {
  const normalized = normalizePath(storedPath);
  if (normalized !== storedPath.replace(/\/+/g, '/').replace(/\/$/, '')) {
    log.warn('validate', `Rejected metadata path with traversal in ${context}`, { path: sanitizePath(storedPath) });
    throw new McpError(ErrorCode.InvalidParams, `Invalid stored path in ${context}: path traversal not allowed`);
  }
  if (config.isUnrestricted) return;
  const trustedRoots = [config.backupDir, ...config.allowedRoots];
  if (trustedRoots.length > 0 && !trustedRoots.some(root => normalized.startsWith(root))) {
    log.warn('validate', `Rejected metadata path outside allowed roots in ${context}`, { path: sanitizePath(storedPath) });
    throw new McpError(ErrorCode.InvalidParams, `Access denied: stored path in ${context} is outside allowed roots`);
  }
}

/** Validates a positive integer parameter with an optional minimum. Returns undefined if absent. */
export function validatePositiveNumber(value: number | undefined, paramName: string, min = 1): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${paramName}: must be an integer >= ${min}, got ${value}`);
  }
  return value;
}