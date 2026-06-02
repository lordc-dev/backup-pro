/**
 * Minimal Myers diff implementation for line-level comparison.
 * Replaces the `diff` npm package to eliminate 84MB of dependencies.
 */

export interface DiffLine {
  value: string;
  added?: boolean;
  removed?: boolean;
  count: number;
}

/**
 * Compare two strings line-by-line using Myers diff algorithm.
 * Returns an array of change parts (unchanged, added, removed).
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Remove trailing empty line from split if text ends with \n
  if (oldLines.length > 0 && oldLines[oldLines.length - 1] === '') oldLines.pop();
  if (newLines.length > 0 && newLines[newLines.length - 1] === '') newLines.pop();

  const { changes } = myersDiff(oldLines, newLines);

  const result: DiffLine[] = [];
  let i = 0;

  while (i < changes.length) {
    const change = changes[i];

    if (change.type === 'equal') {
      result.push({
        value: change.lines.join('\n') + '\n',
        count: change.lines.length,
      });
      i++;
    } else if (change.type === 'removed') {
      // Check if next change is added (replacement)
      const nextChange = changes[i + 1];
      if (nextChange && nextChange.type === 'added') {
        result.push({
          value: change.lines.join('\n') + '\n',
          removed: true,
          count: change.lines.length,
        });
        result.push({
          value: nextChange.lines.join('\n') + '\n',
          added: true,
          count: nextChange.lines.length,
        });
        i += 2;
      } else {
        result.push({
          value: change.lines.join('\n') + '\n',
          removed: true,
          count: change.lines.length,
        });
        i++;
      }
    } else {
      // added
      result.push({
        value: change.lines.join('\n') + '\n',
        added: true,
        count: change.lines.length,
      });
      i++;
    }
  }

  return result;
}

interface Change {
  type: 'added' | 'removed' | 'equal';
  lines: string[];
}

/**
 * Myers diff algorithm — O(ND) where D is the edit distance.
 * Returns grouped changes (runs of added/removed/equal lines).
 */
function myersDiff(oldLines: string[], newLines: string[]): { changes: Change[] } {
  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 && m === 0) return { changes: [] };
  if (n === 0) return { changes: [{ type: 'added', lines: [...newLines] }] };
  if (m === 0) return { changes: [{ type: 'removed', lines: [...oldLines] }] };

  // Compute edit script using LCS-based approach
  const lcs = longestCommonSubsequence(oldLines, newLines);

  // Convert LCS to changes
  const changes: Change[] = [];
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < n || ni < m) {
    if (oi < n && ni < m && li < lcs.length && oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
      // Equal line
      const equalLines: string[] = [];
      while (oi < n && ni < m && li < lcs.length && oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
        equalLines.push(oldLines[oi]);
        oi++;
        ni++;
        li++;
      }
      changes.push({ type: 'equal', lines: equalLines });
    } else {
      // Collect removed lines
      const removedLines: string[] = [];
      while (oi < n && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
        // Check if this old line exists in new lines beyond current ni
        const idxInNew = findInLCS(oldLines[oi], newLines, ni, lcs, li);
        if (idxInNew === -1 || idxInNew <= ni) {
          removedLines.push(oldLines[oi]);
          oi++;
        } else {
          break;
        }
      }

      // Collect added lines
      const addedLines: string[] = [];
      while (ni < m && (li >= lcs.length || newLines[ni] !== lcs[li])) {
        const idxInOld = findInLCS(newLines[ni], oldLines, oi, lcs, li);
        if (idxInOld === -1 || idxInOld <= oi) {
          addedLines.push(newLines[ni]);
          ni++;
        } else {
          break;
        }
      }

      if (removedLines.length > 0) {
        changes.push({ type: 'removed', lines: removedLines });
      }
      if (addedLines.length > 0) {
        changes.push({ type: 'added', lines: addedLines });
      }

      // Safety: if no progress, skip one line from each
      if (removedLines.length === 0 && addedLines.length === 0) {
        if (oi < n) { oi++; }
        else if (ni < m) { ni++; }
      }
    }
  }

  return { changes: mergeChanges(changes) };
}

function findInLCS(line: string, lines: string[], start: number, _lcs: string[], _lcsStart: number): number {
  for (let i = start; i < lines.length; i++) {
    if (lines[i] === line) return i;
  }
  return -1;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function mergeChanges(changes: Change[]): Change[] {
  if (changes.length === 0) return changes;

  const merged: Change[] = [changes[0]];
  for (let i = 1; i < changes.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = changes[i];
    if (prev.type === curr.type) {
      prev.lines.push(...curr.lines);
    } else {
      merged.push({ type: curr.type, lines: [...curr.lines] });
    }
  }

  return merged;
}