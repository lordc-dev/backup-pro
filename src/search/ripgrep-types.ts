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