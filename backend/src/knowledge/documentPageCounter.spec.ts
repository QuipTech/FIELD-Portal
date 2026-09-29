import { PDFDocument } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import {
  countDocumentPages,
  UnreadableDocumentError,
} from './documentPageCounter';

const PDF = 'application/pdf';
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const buildPdf = async (pages: number): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) pdf.addPage();
  return pdf.save();
};

const buildDocx = (appXml?: string): Uint8Array =>
  zipSync({
    'word/document.xml': strToU8('<w:document/>'),
    ...(appXml ? { 'docProps/app.xml': strToU8(appXml) } : {}),
  });

describe('countDocumentPages', () => {
  it('counts PDF pages', async () => {
    expect(await countDocumentPages(await buildPdf(3), PDF)).toBe(3);
  });

  it('reads the page count Word recorded in a DOCX', async () => {
    const docx = buildDocx(
      '<Properties><Pages>7</Pages><Words>900</Words></Properties>',
    );
    expect(await countDocumentPages(docx, DOCX)).toBe(7);
  });

  it('gives null for a DOCX that records no page count', async () => {
    expect(await countDocumentPages(buildDocx(), DOCX)).toBeNull();
  });

  it('gives null for types it cannot count', async () => {
    expect(
      await countDocumentPages(
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]),
        'application/msword',
      ),
    ).toBeNull();
  });

  it('reports a corrupt file as unreadable', async () => {
    const corrupt = new TextEncoder().encode(
      '%PDF-1.4 this is not really a pdf',
    );
    await expect(countDocumentPages(corrupt, PDF)).rejects.toBeInstanceOf(
      UnreadableDocumentError,
    );
    await expect(countDocumentPages(corrupt, DOCX)).rejects.toBeInstanceOf(
      UnreadableDocumentError,
    );
  });
});
