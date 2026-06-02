import { describe, it, expect } from 'vitest';

import { isRipgrepAvailable } from '../search/ripgrep-executor.js';

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

describe('parseJsonResults edge cases', () => {
  it('handles lines with type=begin/end', () => {
    const beginLine = JSON.stringify({ type: 'begin', data: { path: { text: '/file' } } });
    const endLine = JSON.stringify({ type: 'end', data: {} });
    const matchLine = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/file.backup' },
        line_number: 1,
        lines: { text: 'hi\n' },
        submatches: [{ start: 0, end: 2, match: { text: 'hi' } }],
      },
    });
    const results = parseJsonResults(beginLine + '\n' + matchLine + '\n' + endLine);
    expect(results).toHaveLength(1);
  });

  it('uses defaults for missing path/lines/submatches', () => {
    const input = JSON.stringify({
      type: 'match',
      data: { path: {}, line_number: 0, lines: {}, submatches: [] },
    });
    const results = parseJsonResults(input);
    expect(results[0].file).toBe('');
    expect(results[0].content).toBe('');
    expect(results[0].submatches).toHaveLength(0);
  });

  it('preserves content text with trailing newline stripped', () => {
    const input = JSON.stringify({
      type: 'match',
      data: {
        path: { text: '/f.backup' },
        line_number: 1,
        lines: { text: '  padded  \n' },
        submatches: [{ start: 2, end: 7, match: { text: 'padde' } }],
      },
    });
    const results = parseJsonResults(input);
    expect(results[0].content).toBe('  padded  ');
  });

  it('handles multiple matches on separate lines', () => {
    const m1 = JSON.stringify({
      type: 'match',
      data: { path: { text: '/a.backup' }, line_number: 3, lines: { text: 'first\n' }, submatches: [{ start: 0, end: 5, match: { text: 'first' } }] },
    });
    const m2 = JSON.stringify({
      type: 'match',
      data: { path: { text: '/b.backup' }, line_number: 7, lines: { text: 'second\n' }, submatches: [{ start: 0, end: 6, match: { text: 'second' } }] },
    });
    const results = parseJsonResults(m1 + '\n' + m2);
    expect(results).toHaveLength(2);
    expect(results[0].line).toBe(3);
    expect(results[1].line).toBe(7);
  });

  it('skips summary type lines', () => {
    const summary = JSON.stringify({ type: 'summary', data: { elapsed_total: 0.01, stats: {} } });
    const results = parseJsonResults(summary);
    expect(results).toHaveLength(0);
  });

  it('handles empty submatches array', () => {
    const input = JSON.stringify({
      type: 'match',
      data: { path: { text: '/x.backup' }, line_number: 2, lines: { text: 'content\n' }, submatches: [] },
    });
    const results = parseJsonResults(input);
    expect(results[0].submatches).toHaveLength(0);
  });

  it('processes match with line_number and text fields', () => {
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
    expect(results[0].content).toBe('function hello() {');
  });

  it('returns empty array for empty input', () => {
    expect(parseJsonResults('')).toEqual([]);
    expect(parseJsonResults('   ')).toEqual([]);
  });

  it('skips malformed JSON lines', () => {
    const input = 'not-json\n' + JSON.stringify({
      type: 'match',
      data: { path: { text: '/file.backup' }, line_number: 1, lines: { text: 'hello\n' }, submatches: [{ start: 0, end: 5, match: { text: 'hello' } }] },
    });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(1);
  });

  it('skips non-match types', () => {
    const input = JSON.stringify({ type: 'summary', data: {} });
    const results = parseJsonResults(input);
    expect(results).toHaveLength(0);
  });
});

describe('ripgrep module-level code paths', () => {
  it('isRipgrepAvailable returns boolean', async () => {
    const result = await isRipgrepAvailable();
    expect(typeof result).toBe('boolean');
  });
});