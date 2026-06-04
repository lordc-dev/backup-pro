import { describe, it, expect } from 'vitest';
import { validateRegexPattern } from '../validation/regex-validation.js';

describe('validateRegexPattern', () => {
  it('accepts a simple valid pattern', () => {
    const result = validateRegexPattern('hello');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts pattern with character classes', () => {
    const result = validateRegexPattern('[a-zA-Z0-9]+');
    expect(result.valid).toBe(true);
  });

  it('accepts pattern with groups and quantifiers', () => {
    const result = validateRegexPattern('(ab)+cd');
    expect(result.valid).toBe(true);
  });

  it('accepts pattern with anchors', () => {
    const result = validateRegexPattern('^start.*end$');
    expect(result.valid).toBe(true);
  });

  it('accepts pattern with escaped special chars', () => {
    const result = validateRegexPattern('\\.\\*\\?');
    expect(result.valid).toBe(true);
  });

  it('accepts alternation within limits', () => {
    const result = validateRegexPattern('a|b|c');
    expect(result.valid).toBe(true);
  });

  it('rejects empty string', () => {
    const result = validateRegexPattern('');
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('non-empty string');
  });

  it('rejects non-string input (number)', () => {
    const result = validateRegexPattern(42 as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('non-empty string');
  });

  it('rejects pattern with null bytes', () => {
    const result = validateRegexPattern('hello\x00world');
    expect(result.valid).toBe(false);
    expect(result.errorMessage!.toLowerCase()).toContain('null');
  });

  it('rejects pattern exceeding max length', () => {
    const longPattern = 'a'.repeat(1001);
    const result = validateRegexPattern(longPattern);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('too long');
  });

  it('accepts pattern at max length', () => {
    const pattern = 'a'.repeat(1000);
    const result = validateRegexPattern(pattern);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid regex compilation', () => {
    const result = validateRegexPattern('[unclosed');
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('compilation failed');
  });

  it('rejects invalid regex with unmatched parenthesis', () => {
    const result = validateRegexPattern('(abc');
    expect(result.valid).toBe(false);
  });

  it('rejects invalid regex quantifier', () => {
    const result = validateRegexPattern('a***');
    expect(result.valid).toBe(false);
  });

  it('provides suggestions for regex compilation errors', () => {
    const result = validateRegexPattern('[unclosed');
    expect(result.valid).toBe(false);
    if (result.errorMessage) {
      expect(result.errorMessage).toContain('Suggestions');
    }
  });

  it('rejects pattern exceeding nesting depth', () => {
    const deeplyNested = '((((a))))'.replace('a', '((((b))))');
    const result = validateRegexPattern(deeplyNested);
    if (result.valid) {
      const deeper = '(((' + deeplyNested + ')))';
      const deeperResult = validateRegexPattern(deeper);
      expect(deeperResult.valid).toBe(false);
    }
  });

  it('rejects pattern with too many alternations', () => {
    const parts = Array.from({ length: 25 }, (_, i) => `word${i}`);
    const pattern = parts.join('|');
    const result = validateRegexPattern(pattern);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('alternation');
  });

  it('accepts pattern with alternations within limit', () => {
    const parts = Array.from({ length: 10 }, (_, i) => `word${i}`);
    const pattern = parts.join('|');
    const result = validateRegexPattern(pattern);
    expect(result.valid).toBe(true);
  });

  it('detects ReDoS nested quantifier pattern', () => {
    const result = validateRegexPattern('(a+)+b');
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('ReDoS');
  });

  it('detects ReDoS character class with nested quantifier', () => {
    const result = validateRegexPattern('([a-z]+)+b');
    expect(result.valid).toBe(false);
  });

  it('warns about overly broad pattern .*', () => {
    const result = validateRegexPattern('.*');
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('more specific')])
    );
  });

  it('warns about overly broad pattern .+', () => {
    const result = validateRegexPattern('.+');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('warns about double backslash pattern', () => {
    const result = validateRegexPattern('\\\\');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('backslash'))).toBe(true);
  });

  it('does not warn for specific patterns', () => {
    const result = validateRegexPattern('hello\\s+world');
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('accepts pattern with lookbehind (pcre2)', () => {
    const result = validateRegexPattern('(?<=foo)bar', { pcre2: true });
    expect(result.valid).toBe(true);
  });

  it('accepts pattern with lookahead (valid in JS regex)', () => {
    const result = validateRegexPattern('foo(?=bar)');
    expect(result.valid).toBe(true);
  });

  it('rejects pattern with only quantifier', () => {
    const result = validateRegexPattern('*');
    expect(result.valid).toBe(false);
  });

  it('accepts digit pattern', () => {
    const result = validateRegexPattern('\\d{3}-\\d{4}');
    expect(result.valid).toBe(true);
  });

  it('accepts boundary pattern', () => {
    const result = validateRegexPattern('\\bword\\b');
    expect(result.valid).toBe(true);
  });
});