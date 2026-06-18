import { BackupStore } from '../utils/store.js';
import {
  isRipgrepAvailable,
  executeRipgrepWithLimit,
  requiresPCRE2,
  validateRegexPattern,
} from '../search/index.js';
import { rgArgs } from '../search/ripgrep-args.js';
import type { ContentSearchResult } from '../search/ripgrep-types.js';
import { config } from '../utils/config.js';
import { MAX_PATTERN_LENGTH } from '../validation/regex-validation.js';

export interface SearchContentParams {
  pattern: string;
  ignoreCase?: boolean;
  maxResults?: number;
  contextLines?: number;
}

export interface BackupContentMatch {
  backupId: string;
  originalPath: string;
  description: string;
  tags: string[];
  timestamp: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchContentResult {
  query: string;
  totalMatches: number;
  matches: BackupContentMatch[];
  unavailable?: boolean;
  unavailableReason?: string;
}

function isValidRgMatch(data: unknown): data is { type: 'match'; data: { path?: { text?: string }; line_number?: number; lines?: { text?: string }; submatches?: Array<{ match?: { text?: string }; start?: number; end?: number }> } } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.type === 'match' && typeof obj.data === 'object' && obj.data !== null;
}

function parseJsonResults(output: string): ContentSearchResult[] {
  const results: ContentSearchResult[] = [];

  if (!output.trim()) return results;

  const lines = output.trim().split("\n");
  for (const line of lines) {
    try {
      const data: unknown = JSON.parse(line);
      if (isValidRgMatch(data)) {
        const submatches = (data.data.submatches ?? []).map((sm) => ({
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

function buildSearchArgs(
  pattern: string,
  configObj: { backupDir: string },
  options: { ignoreCase: boolean; maxResults: number; contextLines: number }
): string[] {
  return rgArgs()
    .json()
    .noMessages()
    .context(options.contextLines)
    .ignoreCase(options.ignoreCase)
    .maxCount(options.maxResults * 2)
    .glob("*.backup")
    .pattern(pattern)
    .path(configObj.backupDir)
    .build();
}

function buildMatchFromResult(
  result: ContentSearchResult,
  pathToId: Map<string, string>,
  backups: BackupStore
): BackupContentMatch | null {
  const backupId = pathToId.get(result.file);
  if (!backupId) return null;

  const backup = backups.get(backupId);
  if (!backup) return null;

  return {
    backupId,
    originalPath: backup.metadata.originalPath,
    description: backup.metadata.description,
    tags: backup.metadata.tags || [],
    timestamp: backup.metadata.timestamp,
    line: result.line,
    content: result.content,
    matchStart: result.submatches[0]?.start ?? 0,
    matchEnd: result.submatches[0]?.end ?? 0,
  };
}

export async function searchBackupContent(
  params: SearchContentParams,
  backups: BackupStore
): Promise<SearchContentResult> {
  const MAX_RESULTS_CAP = 200;
  const {
    pattern,
    ignoreCase = true,
    maxResults: rawMaxResults = 50,
    contextLines = 0,
  } = params;
  const maxResults = Math.min(rawMaxResults, MAX_RESULTS_CAP);

  const emptyResult: SearchContentResult = {
    query: pattern,
    totalMatches: 0,
    matches: [],
  };

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      ...emptyResult,
      unavailable: true,
      unavailableReason: `Search pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters (got ${pattern.length})`,
    };
  }

  const rgAvailable = await isRipgrepAvailable();
  if (!rgAvailable) {
    return {
      ...emptyResult,
      unavailable: true,
      unavailableReason: 'Ripgrep (rg) is not installed. Install via: brew install ripgrep (macOS) or apt-get install ripgrep (Linux)',
    };
  }

  const pathToId = new Map<string, string>();
  for (const [id, backup] of backups.entries()) {
    pathToId.set(backup.backupPath, id);
  }

  let rgResults: ContentSearchResult[];
  try {
    const validation = validateRegexPattern(pattern, { pcre2: requiresPCRE2(pattern) });
    if (!validation.valid) {
      return {
        ...emptyResult,
        unavailable: true,
        unavailableReason: validation.errorMessage ?? `Invalid search pattern: ${pattern}`,
      };
    }

    const needsPCRE2 = requiresPCRE2(pattern);

    const args = buildSearchArgs(pattern, config, { ignoreCase, maxResults, contextLines });

    const output = await executeRipgrepWithLimit(args, 10 * 1024 * 1024, needsPCRE2);
    rgResults = parseJsonResults(output);
  } catch (error) {
    return {
      ...emptyResult,
      unavailable: true,
      unavailableReason: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const matches: BackupContentMatch[] = [];

  for (const result of rgResults) {
    const match = buildMatchFromResult(result, pathToId, backups);
    if (match) {
      matches.push(match);
    }

    if (matches.length >= maxResults) {
      break;
    }
  }

  return {
    query: pattern,
    totalMatches: matches.length,
    matches,
  };
}