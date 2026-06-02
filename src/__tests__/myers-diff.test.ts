import { describe, it, expect } from 'vitest';
import { diffLines } from '../utils/myers-diff.js';

describe('myers-diff diffLines', () => {
  it('returns empty for identical strings', () => {
    const result = diffLines('hello\nworld', 'hello\nworld');
    expect(result.every(p => !p.added && !p.removed)).toBe(true);
  });

  it('detects added lines', () => {
    const result = diffLines('hello\nworld', 'hello\nbeautiful\nworld');
    const added = result.filter(p => p.added);
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(added.some(p => p.value.includes('beautiful'))).toBe(true);
  });

  it('detects removed lines', () => {
    const result = diffLines('hello\nbeautiful\nworld', 'hello\nworld');
    const removed = result.filter(p => p.removed);
    expect(removed.length).toBeGreaterThanOrEqual(1);
    expect(removed.some(p => p.value.includes('beautiful'))).toBe(true);
  });

  it('detects replacements', () => {
    const result = diffLines('old line\n', 'new line\n');
    const removed = result.filter(p => p.removed);
    const added = result.filter(p => p.added);
    expect(removed.length).toBeGreaterThanOrEqual(1);
    expect(added.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty strings', () => {
    const result = diffLines('', '');
    expect(result.length).toBe(0);
  });

  it('handles one side empty', () => {
    const result = diffLines('', 'hello\n');
    expect(result.length).toBe(1);
    expect(result[0].added).toBe(true);
  });

  it('counts lines correctly', () => {
    const result = diffLines('a\nb\nc\n', 'a\nx\nc\n');
    const removed = result.find(p => p.removed);
    const added = result.find(p => p.added);
    expect(removed?.count).toBe(1);
    expect(added?.count).toBe(1);
  });
});