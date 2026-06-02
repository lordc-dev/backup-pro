/**
 * Ripgrep Type Definitions
 *
 * Shared interfaces for ripgrep operations.
 */

export interface ContentSearchSubmatch {
  text: string;
  start: number;
  end: number;
}

export interface ContentSearchResult {
  file: string;
  line: number;
  content: string;
  submatches: ContentSearchSubmatch[];
}

export interface GlobOptions {
  cwd?: string;
  ignore?: readonly string[];
  onlyFiles?: boolean;
  onlyDirectories?: boolean;
  followSymlinks?: boolean;
  deep?: number;
  absolute?: boolean;
  skipValidation?: boolean;
}

export interface DirectoryListOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  excludePatterns?: string[];
}