/**
 * Regex Pattern Validation
 *
 * Validates regex patterns before passing to ripgrep.
 * Standalone version for backup-pro (no external error-formatters dependency).
 */

export interface PatternValidationResult {
  valid: boolean;
  sanitized?: string;
  errors: string[];
  warnings: string[];
  errorMessage?: string;
}

export interface RegexValidationOptions {
  pcre2?: boolean;
}

export const MAX_PATTERN_LENGTH = 1000;
const MAX_QUANTIFIER_NESTING = 3;
const MAX_ALTERNATION_DEPTH = 20;

function measureQuantifierNesting(pattern: string): number {
  let maxNesting = 0;
  let currentNesting = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '(' && i + 1 < pattern.length && pattern[i + 1] !== '?') {
      currentNesting++;
      if (currentNesting > maxNesting) maxNesting = currentNesting;
    } else if (pattern[i] === ')') {
      currentNesting = Math.max(0, currentNesting - 1);
    }
  }
  return maxNesting;
}

function countAlternations(pattern: string): number {
  let count = 0;
  let inCharClass = false;
  let escaped = false;
  for (const char of pattern) {
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '[') { inCharClass = true; continue; }
    if (char === ']') { inCharClass = false; continue; }
    if (!inCharClass && char === '|') count++;
  }
  return count;
}

function hasReDoSPatterns(pattern: string): string[] {
  const warnings: string[] = [];
  if (/\([^)]*[*+][^)]*\)[*+]/.test(pattern)) {
    warnings.push('Potential ReDoS pattern detected: nested quantifier with backtracking');
  }
  if (/\(\[[^\]]*\][*+]\)[*+]/.test(pattern)) {
    warnings.push('Potential ReDoS pattern detected: character class with nested quantifier');
  }
  return warnings;
}

function validationError(errors: string[], errorMessage: string): PatternValidationResult {
  return { valid: false, errors, warnings: [], errorMessage };
}

function validatePatternBasics(pattern: string): PatternValidationResult | null {
  if (typeof pattern !== "string" || !pattern) {
    return validationError(["Pattern must be a non-empty string"], "Invalid regex pattern: Pattern must be a non-empty string");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return validationError([`Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`], `Invalid regex pattern: Pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH})`);
  }
  if (pattern.includes("\x00")) {
    return validationError(["Pattern contains null bytes"], "Invalid regex pattern: Null bytes are not allowed in patterns");
  }
  return null;
}

function validatePatternCompilation(pattern: string): PatternValidationResult | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const errors = [`Regex compilation failed: ${errorMsg}`];
    const suggestions = suggestRegexFixes(pattern, errorMsg);
    return validationError(errors, formatRegexErrorWithHints(pattern, errors, suggestions));
  }
}

function validatePatternStructure(pattern: string): PatternValidationResult | null {
  const nestingDepth = measureQuantifierNesting(pattern);
  if (nestingDepth > MAX_QUANTIFIER_NESTING) {
    return validationError(
      [`Regex nesting depth (${nestingDepth}) exceeds maximum (${MAX_QUANTIFIER_NESTING}). Simplify the pattern to prevent excessive backtracking.`],
      `Invalid regex pattern: Nesting too deep (${nestingDepth} levels, max ${MAX_QUANTIFIER_NESTING})`
    );
  }

  const alternationCount = countAlternations(pattern);
  if (alternationCount > MAX_ALTERNATION_DEPTH) {
    return validationError(
      [`Regex has too many alternations (${alternationCount}, max ${MAX_ALTERNATION_DEPTH}). Simplify the pattern.`],
      `Invalid regex pattern: Too many alternations (${alternationCount}, max ${MAX_ALTERNATION_DEPTH})`
    );
  }

  const redosWarnings = hasReDoSPatterns(pattern);
  if (redosWarnings.length > 0) {
    return validationError(redosWarnings, `Invalid regex pattern: ${redosWarnings.join('; ')}. Simplify the pattern to prevent catastrophic backtracking.`);
  }

  return null;
}

/**
 * Validates a regex pattern for use with ripgrep
 */
export function validateRegexPattern(
  pattern: string,
  _options: RegexValidationOptions = {}
): PatternValidationResult {
  const basicError = validatePatternBasics(pattern);
  if (basicError) return basicError;

  const compileError = validatePatternCompilation(pattern);
  if (compileError) return compileError;

  const structError = validatePatternStructure(pattern);
  if (structError) return structError;

  const warnings = detectRegexWarnings(pattern);
  return { valid: true, errors: [], warnings };
}

function suggestBraceFixes(pattern: string): string[] {
  const suggestions: string[] = [];
  if (pattern.includes('{') && !pattern.includes(String.raw`\{`)) suggestions.push(String.raw`Escape curly braces: use \{ instead of {`);
  if (pattern.includes('}') && !pattern.includes(String.raw`\}`)) suggestions.push(String.raw`Escape curly braces: use \} instead of }`);
  return suggestions;
}

function suggestBracketFixes(pattern: string): string[] {
  const suggestions: string[] = [];
  if (pattern.includes('[') || pattern.includes(']')) suggestions.push(String.raw`Escape square brackets: use \[ and \] for literal brackets`);
  if (pattern.includes('(') || pattern.includes(')')) suggestions.push(String.raw`Escape parentheses: use \( and \) for literal parentheses`);
  return suggestions;
}

function suggestRegexFixes(pattern: string, errorMsg: string): string[] {
  const suggestions: string[] = [];

  if (errorMsg.includes('repetition') || errorMsg.includes('quantifier')) {
    suggestions.push(...suggestBraceFixes(pattern));
  }

  if (errorMsg.includes('unclosed') || errorMsg.includes('unmatched')) {
    suggestions.push(...suggestBracketFixes(pattern));
  }

  if (errorMsg.includes('invalid escape')) {
    suggestions.push('Check escape sequences - only valid regex escapes are allowed');
  }

  if (suggestions.length === 0) {
    suggestions.push(String.raw`Check regex syntax and escape special characters: . ^ $ * + ? { } [ ] \ | ( )`);
  }

  return suggestions;
}

function detectRegexWarnings(pattern: string): string[] {
  const warnings: string[] = [];

  if (pattern === ".*" || pattern === ".+") {
    warnings.push("Pattern matches almost everything - consider making it more specific");
  }

  if (pattern.includes(String.raw`\\`) && !pattern.includes(String.raw`\\\\`)) {
    warnings.push(String.raw`Pattern contains double backslash (\\) - this matches a literal backslash`);
  }

  return warnings;
}

function formatRegexErrorWithHints(pattern: string, errors: string[], suggestions: string[]): string {
  const lines = [
    `Invalid regex pattern: "${pattern}"`,
    "",
    ...errors,
    "",
    "Suggestions:",
    ...suggestions.map(s => `  - ${s}`),
    "",
    "Common regex special characters that need escaping:",
    String.raw`  . ^ $ * + ? { } [ ] \ | ( )`,
  ];

  return lines.join("\n");
}