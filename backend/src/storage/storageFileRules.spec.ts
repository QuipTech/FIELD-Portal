import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  AVATAR_RULE,
  DOCUMENT_RULE,
  PHOTO_RULE,
  validateIncomingFile,
} from './storageFileRules';

const file = (originalname: string, bytes: number[], size = bytes.length) => ({
  originalname,
  mimetype: 'application/octet-stream',
  size,
  buffer: Buffer.from(bytes),
});

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const HEIC = [0, 0, 0, 0x18, ...Buffer.from('ftypheic')];

describe('validateIncomingFile', () => {
  it('stores the content type for the extension, not the client’s MIME type', () => {
    expect(
      validateIncomingFile(file('Manual.PDF', PDF), DOCUMENT_RULE),
    ).toEqual({
      extension: 'pdf',
      contentType: 'application/pdf',
    });
    expect(
      validateIncomingFile(file('fault.heic', HEIC), PHOTO_RULE).contentType,
    ).toBe('image/heic');
  });

  it('rejects a file whose bytes don’t match its extension', () => {
    expect(() =>
      validateIncomingFile(
        file('invoice.pdf', [0x4d, 0x5a, 0x90, 0x00]),
        DOCUMENT_RULE,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects types a folder doesn’t accept', () => {
    expect(() =>
      validateIncomingFile(file('photo.heic', HEIC), AVATAR_RULE),
    ).toThrow(BadRequestException);
    expect(() =>
      validateIncomingFile(file('scan.png', PNG), DOCUMENT_RULE),
    ).toThrow(BadRequestException);
  });

  it('enforces each folder’s size limit', () => {
    expect(() =>
      validateIncomingFile(
        file('me.jpg', JPEG, 5 * 1024 * 1024 + 1),
        AVATAR_RULE,
      ),
    ).toThrow(PayloadTooLargeException);
    expect(
      validateIncomingFile(file('me.jpg', JPEG, 5 * 1024 * 1024), AVATAR_RULE)
        .extension,
    ).toBe('jpg');
  });

  it('rejects a missing or empty file', () => {
    expect(() => validateIncomingFile(undefined, PHOTO_RULE)).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateIncomingFile(file('empty.png', []), PHOTO_RULE),
    ).toThrow(BadRequestException);
  });
});
