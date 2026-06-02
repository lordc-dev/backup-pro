import { describe, it, expect } from 'vitest';
import { config } from '../utils/config.js';

describe('config', () => {
  it('has required fields', () => {
    expect(config).toHaveProperty('backupDir');
    expect(config).toHaveProperty('autoSaveIntervalMs');
    expect(config).toHaveProperty('maxPreviewChars');
    expect(config).toHaveProperty('allowedRoots');
    expect(config).toHaveProperty('logLevel');
    expect(config).toHaveProperty('batchConcurrency');
  });

  it('has sensible defaults', () => {
    expect(config.autoSaveIntervalMs).toBe(30000);
    expect(config.maxPreviewChars).toBe(10000);
    expect(config.batchConcurrency).toBe(5);
    expect(['debug', 'info', 'warn', 'error']).toContain(config.logLevel);
  });

  it('allowedRoots is an array', () => {
    expect(Array.isArray(config.allowedRoots)).toBe(true);
  });
});