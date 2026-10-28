import { PDFDocument, StandardFonts } from 'pdf-lib';

const PAGE = {
  width: 595,
  height: 842,
  margin: 50,
  lineHeight: 16,
  fontSize: 11,
};

// Helvetica only encodes WinAnsi; anything else (→ etc.) is swapped out.
const toWinAnsi = (text: string) =>
  text.replace(/→/g, '->').replace(/[^\x20-\x7E -ÿ—–·›‹‘’“”…]/g, '?');

// Plain A4 pages of text lines, for the simple PDF exports (configuration
// diff, machine history). Lines longer than the page are clipped.
export const linesToPdf = async (lines: string[]): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const linesPerPage = Math.floor(
    (PAGE.height - 2 * PAGE.margin) / PAGE.lineHeight,
  );
  for (let start = 0; start < lines.length; start += linesPerPage) {
    const page = document.addPage([PAGE.width, PAGE.height]);
    lines.slice(start, start + linesPerPage).forEach((line, index) =>
      page.drawText(toWinAnsi(line), {
        x: PAGE.margin,
        y: PAGE.height - PAGE.margin - index * PAGE.lineHeight,
        size: PAGE.fontSize,
        font,
        maxWidth: PAGE.width - 2 * PAGE.margin,
      }),
    );
  }
  return document.save();
};
