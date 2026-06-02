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

  const warnings = detectRegexWarnings(pattern);

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