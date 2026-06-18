/**
 * Custom Error Types with Error Chaining
 *
 * Typed errors for the search/ripgrep layer. All extend BaseError which
 * preserves cause chain and provides structured context for logging and debugging.
 */

export const ECODE = {
  // Search (10xxx)
  SEARCH_PATTERN: 10001,
  SEARCH_EXEC: 10002,
  SEARCH_TIMEOUT: 10003,
  SEARCH_RG_NOT_FOUND: 10004,
  SEARCH_RG_FAILED: 10005,
} as const;

export type ErrorCode = (typeof ECODE)[keyof typeof ECODE];

export class BaseError extends Error {
  public readonly code: ErrorCode | undefined;
  public readonly context: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown>; code?: ErrorCode }) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.code = options?.code;
    this.context = options?.context ?? {};
    this.timestamp = new Date().toISOString();
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      cause: this.cause instanceof Error ? this.cause.message : String(this.cause ?? ""),
    };
  }
}