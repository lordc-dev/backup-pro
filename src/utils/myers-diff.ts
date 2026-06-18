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

interface Change {
  type: 'added' | 'removed' | 'equal';
  lines: string[];
}

function findInLCS(line: string, lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (lines[i] === line) return i;
  }
  return -1;
}

function collectEqualLines(oldLines: string[], newLines: string[], lcs: string[], indices: { oi: number; ni: number; li: number }): string[] {
  const equalLines: string[] = [];
  const { n, m, lcsLen } = { n: oldLines.length, m: newLines.length, lcsLen: lcs.length };
  while (indices.oi < n && indices.ni < m && indices.li < lcsLen && oldLines[indices.oi] === lcs[indices.li] && newLines[indices.ni] === lcs[indices.li]) {
    equalLines.push(oldLines[indices.oi]);
    indices.oi++;
    indices.ni++;
    indices.li++;
  }
  return equalLines;
}

function collectRemovedLines(oldLines: string[], newLines: string[], lcs: string[], indices: { oi: number; ni: number; li: number }): string[] {
  const removedLines: string[] = [];
  const { oi, ni, li } = indices;
  let idx = oi;
  while (idx < oldLines.length && (li >= lcs.length || oldLines[idx] !== lcs[li])) {
    const idxInNew = findInLCS(oldLines[idx], newLines, ni);
    if (idxInNew === -1 || idxInNew <= ni) {
      removedLines.push(oldLines[idx]);
      idx++;
    } else {
      break;
    }
  }
  indices.oi = idx;
  return removedLines;
}

function collectAddedLines(oldLines: string[], newLines: string[], lcs: string[], indices: { oi: number; ni: number; li: number }): string[] {
  const addedLines: string[] = [];
  const { oi, ni, li } = indices;
  let idx = ni;
  while (idx < newLines.length && (li >= lcs.length || newLines[idx] !== lcs[li])) {
    const idxInOld = findInLCS(newLines[idx], oldLines, oi);
    if (idxInOld === -1 || idxInOld <= oi) {
      addedLines.push(newLines[idx]);
      idx++;
    } else {
      break;
    }
  }
  indices.ni = idx;
  return addedLines;
}

function advancePastNonLCS(oldLines: string[], newLines: string[], lcs: string[], indices: { oi: number; ni: number; li: number }): void {
  const removedLines = collectRemovedLines(oldLines, newLines, lcs, indices);
  const addedLines = collectAddedLines(oldLines, newLines, lcs, indices);
  if (removedLines.length === 0 && addedLines.length === 0) {
    if (indices.oi < oldLines.length) { indices.oi++; }
    else if (indices.ni < newLines.length) { indices.ni++; }
  }
}

function isLCSMatch(oldLines: string[], newLines: string[], lcs: string[], indices: { oi: number; ni: number; li: number }): boolean {
  return indices.oi < oldLines.length && indices.ni < newLines.length && indices.li < lcs.length && oldLines[indices.oi] === lcs[indices.li] && newLines[indices.ni] === lcs[indices.li];
}

function computeChangesFromLCS(oldLines: string[], newLines: string[], lcs: string[]): Change[] {
  const n = oldLines.length;
  const m = newLines.length;
  const changes: Change[] = [];
  const indices = { oi: 0, ni: 0, li: 0 };

  while (indices.oi < n || indices.ni < m) {
    if (isLCSMatch(oldLines, newLines, lcs, indices)) {
      const equalLines = collectEqualLines(oldLines, newLines, lcs, indices);
      changes.push({ type: 'equal', lines: equalLines });
    } else {
      const removedLines = collectRemovedLines(oldLines, newLines, lcs, indices);
      const addedLines = collectAddedLines(oldLines, newLines, lcs, indices);
      if (removedLines.length > 0) changes.push({ type: 'removed', lines: removedLines });
      if (addedLines.length > 0) changes.push({ type: 'added', lines: addedLines });
      if (removedLines.length === 0 && addedLines.length === 0) advancePastNonLCS(oldLines, newLines, lcs, indices);
    }
  }

  return mergeChanges(changes);
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

function toDiffLine(change: Change): DiffLine {
  return {
    value: change.lines.join('\n') + '\n',
    count: change.lines.length,
    ...(change.type === 'added' ? { added: true } : {}),
    ...(change.type === 'removed' ? { removed: true } : {}),
  };
}

function toDiffLinePair(removed: Change, added: Change): DiffLine[] {
  return [
    { value: removed.lines.join('\n') + '\n', removed: true, count: removed.lines.length },
    { value: added.lines.join('\n') + '\n', added: true, count: added.lines.length },
  ];
}

function convertChangesToDiffLines(changes: Change[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = 0;

  while (i < changes.length) {
    const change = changes[i];

    if (change.type === 'equal') {
      result.push(toDiffLine(change));
      i++;
    } else if (change.type === 'removed' && changes[i + 1]?.type === 'added') {
      result.push(...toDiffLinePair(change, changes[i + 1]));
      i += 2;
    } else {
      result.push(toDiffLine(change));
      i++;
    }
  }

  return result;
}

/** Compare two strings line-by-line using Myers diff algorithm.
 *  Returns an array of change parts (unchanged, added, removed).
 *  If either text exceeds MAX_DIFF_LINES, returns a summary instead. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const MAX_DIFF_LINES = 50000;
  const MAX_DIFF_PRODUCT = 10_000_000;

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
    return [{ value: `Diff too large: ${oldLines.length} + ${newLines.length} lines (max ${MAX_DIFF_LINES}). Use preview_backup for partial view.`, count: 1 }];
  }

  if (oldLines.length > 0 && oldLines[oldLines.length - 1] === '') oldLines.pop();
  if (newLines.length > 0 && newLines[newLines.length - 1] === '') newLines.pop();

  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ value: newLines.join('\n') + '\n', added: true, count: m }];
  if (m === 0) return [{ value: oldLines.join('\n') + '\n', removed: true, count: n }];

  if (n * m > MAX_DIFF_PRODUCT) {
    return [{ value: `Diff too large: ${n} × ${m} line pairs exceeds product limit ${MAX_DIFF_PRODUCT}. Use preview_backup for partial view.`, count: 1 }];
  }

  const lcs = longestCommonSubsequence(oldLines, newLines);
  const changes = computeChangesFromLCS(oldLines, newLines, lcs);

  return convertChangesToDiffLines(changes);
}