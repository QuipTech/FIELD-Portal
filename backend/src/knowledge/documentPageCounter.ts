import { PDFDocument } from 'pdf-lib';
import { strFromU8, unzipSync } from 'fflate';

const PDF = 'application/pdf';
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// The file claims to be a PDF/DOCX but can't be parsed as one.
export class UnreadableDocumentError extends Error {}

// Password-protected PDFs still expose their page tree, so encryption
// is ignored — only the count is read, never the content.
const countPdfPages = async (bytes: Uint8Array): Promise<number> => {
  try {
    const pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return pdf.getPageCount();
  } catch (error) {
    throw new UnreadableDocumentError(`Not a readable PDF: ${String(error)}`);
  }
};

// Word stores the page count it last laid out in docProps/app.xml. Files
// from other editors may leave it out, which gives null (unknown).
const countDocxPages = (bytes: Uint8Array): number | null => {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => file.name === 'docProps/app.xml',
    });
  } catch (error) {
    throw new UnreadableDocumentError(`Not a readable DOCX: ${String(error)}`);
  }
  const appXml = files['docProps/app.xml'];
  const pages = appXml && /<Pages>(\d+)<\/Pages>/.exec(strFromU8(appXml))?.[1];
  return pages ? Number(pages) : null;
};

// Null when the type isn't countable (e.g. legacy .doc) or the count isn't
// recorded in the file.
export const countDocumentPages = async (
  bytes: Uint8Array,
  contentType: string,
): Promise<number | null> => {
  if (contentType === PDF) return countPdfPages(bytes);
  if (contentType === DOCX) return countDocxPages(bytes);
  return null;
};
