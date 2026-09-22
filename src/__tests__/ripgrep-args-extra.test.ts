import { describe, it, expect } from 'vitest';
import { rgArgs, RipgrepArgsBuilder } from '../search/ripgrep-args.js';

describe('RipgrepArgsBuilder', () => {
  it('builds empty args', () => {
    const result = rgArgs().build();
    expect(result).toEqual([]);
  });

  it('adds json mode flags', () => {
    const result = rgArgs().json().build();
    expect(result).toContain('--json');
    expect(result).toContain('--no-heading');
    expect(result).toContain('--line-number');
  });

  it('adds no-messages flag', () => {
    const result = rgArgs().noMessages().build();
    expect(result).toContain('--no-messages');
  });

  it('adds ignore-case when enabled', () => {
    const result = rgArgs().ignoreCase().build();
    expect(result).toContain('--ignore-case');
  });

  it('skips ignore-case when disabled', () => {
    const result = rgArgs().ignoreCase(false).build();
    expect(result).not.toContain('--ignore-case');
  });

  it('adds context lines', () => {
    const result = rgArgs().context(3).build();
    expect(result).toEqual(expect.arrayContaining(['-C', '3']));
  });

  it('skips context when lines is 0', () => {
    const result = rgArgs().context(0).build();
    expect(result).not.toContain('-C');
  });

  it('adds max-count', () => {
    const result = rgArgs().maxCount(10).build();
    expect(result).toEqual(expect.arrayContaining(['--max-count', '10']));
  });

  it('skips max-count when 0', () => {
    const result = rgArgs().maxCount(0).build();
    expect(result).not.toContain('--max-count');
  });

  it('adds glob with string', () => {
    const result = rgArgs().glob('*.ts').build();
    expect(result).toEqual(expect.arrayContaining(['--glob', '*.ts']));
  });

  it('adds glob with array', () => {
    const result = rgArgs().glob(['*.ts', '*.js']).build();
    expect(result).toContain('--glob');
    expect(result.filter(x => x === '*.ts' || x === '*.js')).toHaveLength(2);
  });

  it('adds pattern', () => {
    const result = rgArgs().pattern('TODO').build();
    expect(result).toContain('TODO');
  });

  it('adds path', () => {
    const result = rgArgs().path('/tmp/search').build();
    expect(result).toContain('/tmp/search');
  });

  it('chains multiple methods', () => {
    const result = rgArgs()
      .json()
      .ignoreCase()
      .maxCount(50)
      .glob('*.backup')
      .pattern('TODO')
      .path('/src')
      .build();
    expect(result).toContain('--json');
    expect(result).toContain('--ignore-case');
    expect(result).toContain('--max-count');
    expect(result).toContain('TODO');
    expect(result).toContain('/src');
  });

  it('returns a new array each time build() is called', () => {
    const builder = rgArgs().json();
    const result1 = builder.build();
    const result2 = builder.build();
    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);
  });
});

describe('RipgrepArgsBuilder direct instantiation', () => {
  it('allows creating a fresh builder instance', () => {
    const builder = new RipgrepArgsBuilder();
    const result = builder.json().pattern('test').path('/tmp').build();
    expect(result).toContain('--json');
    expect(result).toContain('test');
    expect(result).toContain('/tmp');
  });
});