/**
 * Search Module
 *
 * Ripgrep-based search for backup content.
 * Uses the executor layer (concurrency limiting, timeout, byte-limit, PCRE2 detection).
 */

export type {
  ContentSearchSubmatch,
  ContentSearchResult,
} from "./ripgrep-types.js";

export {
  rgArgs,
} from "./ripgrep-args.js";

export {
  isRipgrepAvailable,
  requiresPCRE2,
  executeRipgrepWithLimit,
} from "./ripgrep-executor.js";

export {
  validateRegexPattern,
  type PatternValidationResult,
  type RegexValidationOptions,
} from "../validation/regex-validation.js";