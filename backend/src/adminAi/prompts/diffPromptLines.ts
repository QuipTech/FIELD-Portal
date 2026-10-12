import { PromptDiffLineType } from '../types/adminAiResponse';

export interface DiffLine {
  type: PromptDiffLineType;
  text: string;
}

// Line-level diff via longest common subsequence: lines only in `before`
// are removed, lines only in `after` are added. O(n·m), which is fine for
// prompts (a few hundred lines at most).
export const diffPromptLines = (before: string, after: string): DiffLine[] => {
  const a = before.split('\n');
  const b = after.split('\n');
  const common: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] =
        a[i] === b[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (common[i + 1][j] >= common[i][j + 1]) {
      lines.push({ type: 'removed', text: a[i++] });
    } else {
      lines.push({ type: 'added', text: b[j++] });
    }
  }
  while (i < a.length) lines.push({ type: 'removed', text: a[i++] });
  while (j < b.length) lines.push({ type: 'added', text: b[j++] });
  return lines;
};
