import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractPdf } from './pdfPageExtractor';
import { DocumentExtractionError } from './documentBlocks';

const buildPdf = async (
  pages: { heading?: string; body: string[] }[],
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const content of pages) {
    const page = pdf.addPage([600, 800]);
    let y = 740;
    if (content.heading) {
      page.drawText(content.heading, { x: 50, y, size: 20, font });
      y -= 40;
    }
    for (const line of content.body) {
      page.drawText(line, { x: 50, y, size: 11, font });
      y -= 16;
    }
  }
  return pdf.save();
};

describe('extractPdf', () => {
  it('returns text per page and detects headings by font size', async () => {
    const bytes = await buildPdf([
      {
        heading: 'Hydraulic System',
        body: [
          'Check the CAT 793F charge pressure daily.',
          'Record readings in the log.',
        ],
      },
      { body: ['Replace filters every 500 hours of operation.'] },
    ]);
    const pagesDone: number[] = [];
    const result = await extractPdf(bytes, async (done, total) => {
      pagesDone.push(done);
      expect(total).toBe(2);
    });

    expect(result.pageCount).toBe(2);
    expect(pagesDone).toEqual([1, 2]);
    expect(result.blocks).toContainEqual({
      page: 1,
      text: 'Hydraulic System',
      isHeading: true,
    });
    expect(result.blocks.find((block) => block.page === 2)?.text).toContain(
      'Replace filters every 500 hours',
    );
    expect(result.imageOnlyPages).toEqual([]);
  });

  it('flags pages without a text layer as image-only (OCR candidates)', async () => {
    const bytes = await buildPdf([
      { body: ['Enough text on this page to count as text.'] },
      { body: [] },
    ]);
    const result = await extractPdf(bytes, async () => undefined);
    expect(result.imageOnlyPages).toEqual([2]);
  });

  it('reports a corrupt file with an actionable message', async () => {
    const corrupt = new TextEncoder().encode('%PDF-1.4 not really a pdf');
    await expect(
      extractPdf(corrupt, async () => undefined),
    ).rejects.toBeInstanceOf(DocumentExtractionError);
  });
});
