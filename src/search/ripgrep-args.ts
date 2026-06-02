/**
 * Ripgrep Arguments Builder
 *
 * Fluent API for constructing ripgrep command arguments.
 */

export class RipgrepArgsBuilder {
  private args: string[] = [];

  files(): this {
    this.args.push("--files");
    return this;
  }

  json(): this {
    this.args.push("--json", "--no-heading", "--line-number");
    return this;
  }

  noMessages(): this {
    this.args.push("--no-messages");
    return this;
  }

  hidden(): this {
    this.args.push("--hidden");
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

  maxDepth(depth: number): this {
    if (depth !== undefined) this.args.push("--max-depth", depth.toString());
    return this;
  }

  maxCount(count: number): this {
    if (count > 0) this.args.push("--max-count", count.toString());
    return this;
  }

  count(): this {
    this.args.push("--count");
    return this;
  }

  follow(enabled = true): this {
    if (enabled) this.args.push("--follow");
    return this;
  }

  fileType(type: string): this {
    if (type) this.args.push("--type", type);
    return this;
  }

  exclude(patterns: readonly string[] = []): this {
    patterns.forEach(p => this.args.push("--glob", `!${p}`));
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

export function parseRipgrepLines(output: string): string[] {
  return output.trim().split("\n").filter(Boolean);
}