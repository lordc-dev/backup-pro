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
  autoFix?: boolean;
  pcre2?: boolean;
}

const MAX_PATTERN_LENGTH = 1000;
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
  for (let i = 0; i < pattern.length; i++) {
    if (escaped) { escaped = false; continue; }
    if (pattern[i] === '\\') { escaped = true; continue; }
    if (pattern[i] === '[') { inCharClass = true; continue; }
    if (pattern[i] === ']') { inCharClass = false; continue; }
    if (!inCharClass && pattern[i] === '|') count++;
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

/**
 * Validates a regex pattern for use with ripgrep
 */
export function validateRegexPattern(
  pattern: string,
  options: RegexValidationOptions = {}
): PatternValidationResult {
  if (typeof pattern !== "string" || !pattern) {
    return {
      valid: false,
      errors: ["Pattern must be a non-empty string"],
      warnings: [],
      errorMessage: "Invalid regex pattern: Pattern must be a non-empty string",
    };
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      errors: [`Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`],
      warnings: [],
      errorMessage: `Invalid regex pattern: Pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH})`,
    };
  }

  if (pattern.includes("\x00")) {
    return {
      valid: false,
      errors: ["Pattern contains null bytes"],
      warnings: [],
      errorMessage: "Invalid regex pattern: Null bytes are not allowed in patterns",
    };
  }

  try {
    new RegExp(pattern);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const errors = [`Regex compilation failed: ${errorMsg}`];
    const suggestions = suggestRegexFixes(pattern, errorMsg);

    if (options.autoFix) {
      const fixed = autoFixRegexPattern(pattern);
      if (fixed !== pattern) {
        try {
          new RegExp(fixed);
          return {
            valid: true,
            sanitized: fixed,
            errors: [],
            warnings: [`Auto-fixed pattern from "${pattern}" to "${fixed}"`],
          };
        } catch {
          // Auto-fix failed, fall through to error
        }
      }
    }

    return {
      valid: false,
      errors,
      warnings: [],
      errorMessage: formatRegexErrorWithHints(pattern, errors, suggestions),
    };
  }

  const warnings: string[] = [];

  const nestingDepth = measureQuantifierNesting(pattern);
  if (nestingDepth > MAX_QUANTIFIER_NESTING) {
    return {
      valid: false,
      errors: [`Regex nesting depth (${nestingDepth}) exceeds maximum (${MAX_QUANTIFIER_NESTING}). Simplify the pattern to prevent excessive backtracking.`],
      warnings: [],
      errorMessage: `Invalid regex pattern: Nesting too deep (${nestingDepth} levels, max ${MAX_QUANTIFIER_NESTING})`,
    };
  }

  const alternationCount = countAlternations(pattern);
  if (alternationCount > MAX_ALTERNATION_DEPTH) {
    return {
      valid: false,
      errors: [`Regex has too many alternations (${alternationCount}, max ${MAX_ALTERNATION_DEPTH}). Simplify the pattern.`],
      warnings: [],
      errorMessage: `Invalid regex pattern: Too many alternations (${alternationCount}, max ${MAX_ALTERNATION_DEPTH})`,
    };
  }

  const redosWarnings = hasReDoSPatterns(pattern);
  if (redosWarnings.length > 0) {
    return {
      valid: false,
      errors: redosWarnings,
      warnings: [],
      errorMessage: `Invalid regex pattern: ${redosWarnings.join('; ')}. Simplify the pattern to prevent catastrophic backtracking.`,
    };
  }

  warnings.push(...detectRegexWarnings(pattern));

  return {
    valid: true,
    errors: [],
    warnings,
  };
}

function suggestRegexFixes(pattern: string, errorMsg: string): string[] {
  const suggestions: string[] = [];

  if (errorMsg.includes("repetition") || errorMsg.includes("quantifier")) {
    if (pattern.includes("{") && !pattern.includes("\\{")) {
      suggestions.push("Escape curly braces: use \\{ instead of {");
    }
    if (pattern.includes("}") && !pattern.includes("\\}")) {
      suggestions.push("Escape curly braces: use \\} instead of }");
    }
  }

  if (errorMsg.includes("unclosed") || errorMsg.includes("unmatched")) {
    if (pattern.includes("[") || pattern.includes("]")) {
      suggestions.push("Escape square brackets: use \\[ and \\] for literal brackets");
    }
    if (pattern.includes("(") || pattern.includes(")")) {
      suggestions.push("Escape parentheses: use \\( and \\) for literal parentheses");
    }
  }

  if (errorMsg.includes("invalid escape")) {
    suggestions.push("Check escape sequences - only valid regex escapes are allowed");
  }

  if (suggestions.length === 0) {
    suggestions.push("Check regex syntax and escape special characters: . ^ $ * + ? { } [ ] \\ | ( )");
  }

  return suggestions;
}

function autoFixRegexPattern(pattern: string): string {
  let fixed = pattern;

  fixed = fixed.replace(/([^\\])\{(?!\d)/g, "$1\\{");
  fixed = fixed.replace(/([^\\])\}(?!\d)/g, "$1\\}");

  if (fixed.startsWith("{")) {
    fixed = "\\" + fixed;
  }

  fixed = fixed.replace(/([^\\])\[(\w+)\]/g, "$1\\[$2\\]");

  return fixed;
}

function detectRegexWarnings(pattern: string): string[] {
  const warnings: string[] = [];

  if (pattern === ".*" || pattern === ".+") {
    warnings.push("Pattern matches almost everything - consider making it more specific");
  }

  if (pattern.includes("\\\\") && !pattern.includes("\\\\\\\\")) {
    warnings.push("Pattern contains double backslash (\\\\) - this matches a literal backslash");
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
    "  . ^ $ * + ? { } [ ] \\ | ( )",
  ];

  return lines.join("\n");
}