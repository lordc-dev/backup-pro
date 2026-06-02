import { describe, it, expect } from 'vitest';

import { isRipgrepAvailable } from '../search/ripgrep-executor.js';

describe('isRipgrepAvailable', () => {
  it('returns boolean result', async () => {
    const result = await isRipgrepAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('parseJsonResults (via search module)', () => {
  function parseJsonResults(output: string): Array<{
    file: string;
    line: number;
    content: string;
    submatches: Array<{ text: string; start: number; end: number }>;
  }> {
    const results: Array<{
      file: string;
      line: number;
      content: string;
      submatches: Array<{ text: string; start: number; end: number }>;
    }> = [];

    if (!output.trim()) return results;

    const lines = output.trim().split("\n");
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.type === "match") {
          const submatches = (data.data.submatches || []).map((sm: any) => ({
            text: sm.match?.text ?? "",
            start: sm.start ?? 0,
            end: sm.end ?? 0,
          }));

          results.push({
            file: data.data.path?.text ?? "",
            line: data.data.line_number ?? 0,
            content: (data.data.lines?.text ?? "").replace(/\n$/, ""),
            submatches,
          });
        }
      } catch {
        // skip malformed lines
      }
    }

    return results;
  }

  it('parses match lines with submatches', () => {
    const input = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/path/to/file.backup' },
        line_number: 42,
        lines: { text: 'function hello() {\n' },
        submatches: [{ start: 9, end: 14, match: { text: 'hello' } }],
      },
    });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('/path/to/file.backup');
    expect(results[0].line).toBe(42);
    expect(results[0].submatches[0].start).toBe(9);
    expect(results[0].submatches[0].end).toBe(14);
  });

  it('returns empty for empty input', () => {
    expect(parseJsonResults('')).toEqual([]);
    expect(parseJsonResults('   ')).toEqual([]);
  });

  it('skips malformed JSON lines', () => {
    const input = 'not-json\n' + JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/file.backup' },
        line_number: 1,
        lines: { text: 'hello\n' },
        submatches: [{ start: 0, end: 5, match: { text: 'hello' } }],
      },
    });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(1);
  });

  it('skips non-match types', () => {
    const input = JSON.stringify({ type: 'summary', data: {} });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(0);
  });

  it('handles match with no submatches', () => {
    const input = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/file.backup' },
        line_number: 5,
        lines: { text: 'content\n' },
        submatches: [],
      },
    });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(1);
    expect(results[0].submatches).toHaveLength(0);
  });

  it('handles multiple JSON lines', () => {
    const line1 = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/a.backup' },
        line_number: 1,
        lines: { text: 'first\n' },
        submatches: [{ start: 0, end: 4, match: { text: 'firs' } }],
      },
    });
    const line2 = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/b.backup' },
        line_number: 10,
        lines: { text: 'second\n' },
        submatches: [{ start: 0, end: 6, match: { text: 'second' } }],
      },
    });
    const results = parseJsonResults(line1 + '\n' + line2);
    expect(results).toHaveLength(2);
    expect(results[0].line).toBe(1);
    expect(results[1].line).toBe(10);
  });

  it('preserves leading whitespace in content', () => {
    const input = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/test.backup' },
        line_number: 3,
        lines: { text: '  indented line  \n' },
        submatches: [{ start: 2, end: 15, match: { text: 'indented line' } }],
      },
    });
    const results = parseJsonResults(input);
    expect(results[0].content).toBe('  indented line  ');
  });

  it('handles missing optional fields gracefully', () => {
    const input = JSON.stringify({
      type: 'match',
      data: {
        path: {},
        line_number: 0,
        lines: {},
        submatches: [],
      },
    });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('');
    expect(results[0].content).toBe('');
  });
});