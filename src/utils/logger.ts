/** Log level type, ordered by severity: debug < info < warn < error. */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// SSOT: log level comes from config.ts (which parses LOG_LEVEL once).
import { config } from './config.js';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel];
}

function formatMessage(level: LogLevel, component: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
  if (data && Object.keys(data).length > 0) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

/** Structured logger that writes to stderr, respecting the configured log level. */
export const log = {
  debug(component: string, message: string, data?: Record<string, unknown>): void {
    if (shouldLog('debug')) console.error(formatMessage('debug', component, message, data));
  },
  info(component: string, message: string, data?: Record<string, unknown>): void {
    if (shouldLog('info')) console.error(formatMessage('info', component, message, data));
  },
  warn(component: string, message: string, data?: Record<string, unknown>): void {
    if (shouldLog('warn')) console.error(formatMessage('warn', component, message, data));
  },
  error(component: string, message: string, data?: Record<string, unknown>): void {
    if (shouldLog('error')) console.error(formatMessage('error', component, message, data));
  },
};