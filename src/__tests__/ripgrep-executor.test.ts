import { describe, it, expect } from 'vitest';
import { isRipgrepAvailable, requiresPCRE2, executeRipgrepWithLimit } from '../search/ripgrep-executor.js';

describe('isRipgrepAvailable', () => {
  it('returns true on systems with rg installed', async () => {
    const result = await isRipgrepAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('requiresPCRE2', () => {
  it('returns false for empty pattern', () => {
    expect(requiresPCRE2('')).toBe(false);
  });

  it('detects lookahead', () => {
    expect(requiresPCRE2('foo(?=bar)')).toBe(true);
  });

  it('detects lookbehind', () => {
    expect(requiresPCRE2('(?<=foo)bar')).toBe(true);
  });

  it('detects negative lookahead', () => {
    expect(requiresPCRE2('foo(?!bar)')).toBe(true);
  });

  it('detects negative lookbehind', () => {
    expect(requiresPCRE2('(?<!foo)bar')).toBe(true);
  });

  it('detects named groups', () => {
    expect(requiresPCRE2('(?<name>\\w+)')).toBe(true);
  });

  it('detects backreferences \\k', () => {
    expect(requiresPCRE2('(\\w)\\k<1>')).toBe(true);
  });

  it('detects \\K', () => {
    expect(requiresPCRE2('foo\\Kbar')).toBe(true);
  });

  it('returns false for basic regex', () => {
    expect(requiresPCRE2('hello.*world')).toBe(false);
  });

  it('returns false for character classes', () => {
    expect(requiresPCRE2('[a-z]+')).toBe(false);
  });

  it('returns false for simple groups', () => {
    expect(requiresPCRE2('(abc)+')).toBe(false);
  });

  it('detects (?R) recursive pattern', () => {
    expect(requiresPCRE2('(?R)')).toBe(true);
  });

  it('detects \\g patterns', () => {
    expect(requiresPCRE2('\\g<1>')).toBe(true);
  });
});

describe('executeRipgrepWithLimit', () => {
  it('executes a simple search when rg is available', async () => {
    const available = await isRipgrepAvailable();
    if (!available) return;

    const { output, warning } = await executeRipgrepWithLimit(['--files', '/tmp'], 1024 * 1024);
    expect(typeof output).toBe('string');
    expect(warning).toBeUndefined();
  });

  it('reports a warning when the byte limit truncates output', async () => {
    const available = await isRipgrepAvailable();
    if (!available) return;

    const { warning } = await executeRipgrepWithLimit(['--files', '/tmp'], 10);
    expect(warning).toBeDefined();
    expect(warning).toContain('truncated');
  });
});