/**
 * Ripgrep Arguments Builder
 *
 * Fluent API for constructing ripgrep command arguments.
 * Only the methods used by search-content are kept.
 */

export class RipgrepArgsBuilder {
  private args: string[] = [];

  json(): this {
    this.args.push("--json", "--no-heading", "--line-number");
    return this;
  }

  noMessages(): this {
    this.args.push("--no-messages");
    return this;
  }

  ignoreCase(enabled = true): this {
    if (enabled) this.args.push("--ignore-case");
    return this;
  }

  context(lines: number): this {
    if (lines > 0) this.args.push("-C", lines.toString());
    return this;
  }

  maxCount(count: number): this {
    if (count > 0) this.args.push("--max-count", count.toString());
    return this;
  }

  glob(patterns: string | string[]): this {
    const arr = Array.isArray(patterns) ? patterns : [patterns];
    arr.forEach(p => this.args.push("--glob", p));
    return this;
  }

  pattern(p: string): this {
    this.args.push(p);
    return this;
  }

  path(p: string): this {
    this.args.push(p);
    return this;
  }

  build(): string[] {
    return [...this.args];
  }
}

export function rgArgs(): RipgrepArgsBuilder {
  return new RipgrepArgsBuilder();
}