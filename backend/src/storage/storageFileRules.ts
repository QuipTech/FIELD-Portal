import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { IncomingFile } from './types/storedFile';
import { isSafeSvg } from './svgSafety';

const MB = 1024 * 1024;

interface FileRule {
  label: string;
  maxBytes: number;
  // Accepted extensions and the content type each is stored as.
  contentTypes: Record<string, string>;
}

export const DOCUMENT_RULE: FileRule = {
  label: 'PDF or Word documents',
  maxBytes: 20 * MB,
  contentTypes: {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
};

export const PHOTO_RULE: FileRule = {
  label: 'JPG, PNG or HEIC photos',
  maxBytes: 10 * MB,
  contentTypes: {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
  },
};

export const AVATAR_RULE: FileRule = {
  label: 'JPG or PNG images',
  maxBytes: 5 * MB,
  contentTypes: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' },
};

// An organisation's logo (Settings → Branding).
export const LOGO_RULE: FileRule = {
  label: 'PNG, JPG or SVG images without scripts',
  maxBytes: 2 * MB,
  contentTypes: {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
  },
};

// Support case attachments: photos of the fault, or a document.
export const CASE_ATTACHMENT_RULE: FileRule = {
  label: 'photos (JPG, PNG, HEIC) or PDF/Word documents',
  maxBytes: 20 * MB,
  contentTypes: { ...PHOTO_RULE.contentTypes, ...DOCUMENT_RULE.contentTypes },
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'mif1', 'msf1'];

// The file's leading bytes must match its extension, so a renamed
// executable can't be stored as "report.pdf".
const hasMatchingSignature = (extension: string, buffer: Buffer): boolean => {
  switch (extension) {
    case 'pdf':
      return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]);
    case 'doc':
      return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0]);
    case 'docx':
      return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
    case 'jpg':
    case 'jpeg':
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case 'png':
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]);
    case 'heic':
      return (
        buffer.toString('ascii', 4, 8) === 'ftyp' &&
        HEIC_BRANDS.includes(buffer.toString('ascii', 8, 12))
      );
    case 'svg':
      return isSafeSvg(buffer);
    default:
      return false;
  }
};

export const fileExtension = (fileName: string): string =>
  fileName.includes('.') ? (fileName.split('.').pop() ?? '').toLowerCase() : '';

// Returns the validated extension and the content type to store it as —
// never the client-supplied MIME type.
export const validateIncomingFile = (
  file: IncomingFile | undefined,
  rule: FileRule,
): { extension: string; contentType: string } => {
  if (!file?.buffer?.length)
    throw new BadRequestException('Attach a file to upload.');
  if (file.size > rule.maxBytes) {
    throw new PayloadTooLargeException(
      `Files can be at most ${rule.maxBytes / MB} MB.`,
    );
  }
  const extension = fileExtension(file.originalname);
  const contentType = rule.contentTypes[extension];
  if (!contentType || !hasMatchingSignature(extension, file.buffer)) {
    throw new BadRequestException(`Only ${rule.label} can be uploaded.`);
  }
  return { extension, contentType };
};
