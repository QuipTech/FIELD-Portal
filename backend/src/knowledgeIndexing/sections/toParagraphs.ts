// A line that starts a list item or table row: "•", "-", "*", "1 ", "2)".
const LIST_ITEM = /^([•\-*–]|\d+[.)]?)\s/;
const SENTENCE_END = /[.!?:]$/;

// PDF text comes as the page's wrapped lines. Joins them back into
// paragraphs: a new one starts after a sentence end, or at a list item or
// table row (a wrapped list item's next line still joins it). Paragraphs
// are separated by a blank line.
export const toParagraphs = (lines: string[]): string => {
  const paragraphs: string[] = [];
  for (const line of lines) {
    const previous = paragraphs[paragraphs.length - 1];
    const startsNew =
      previous === undefined ||
      LIST_ITEM.test(line) ||
      SENTENCE_END.test(previous);
    if (startsNew) paragraphs.push(line);
    else paragraphs[paragraphs.length - 1] = `${previous} ${line}`;
  }
  return paragraphs.join('\n\n');
};
