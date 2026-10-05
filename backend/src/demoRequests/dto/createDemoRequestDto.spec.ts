import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateDemoRequestDto } from './createDemoRequestDto';

const VALID = {
  email: 'jo@acme.com',
  firstName: 'Jo',
  lastName: 'Bloggs',
  company: 'Acme Mining',
  country: 'Australia',
};

const toDto = (body: object) => plainToInstance(CreateDemoRequestDto, body);
const failedFields = (body: object) =>
  validateSync(toDto(body)).map((error) => error.property);

describe('CreateDemoRequestDto', () => {
  it('accepts the required fields alone', () => {
    expect(failedFields(VALID)).toEqual([]);
  });

  it('trims every string, and blank optional fields count as not given', () => {
    const dto = toDto({
      ...VALID,
      email: '  jo@acme.com ',
      firstName: ' Jo ',
      company: ' Acme Mining  ',
      phone: '   ',
      message: '  Hello  ',
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({
      email: 'jo@acme.com',
      firstName: 'Jo',
      company: 'Acme Mining',
      phone: undefined,
      message: 'Hello',
    });
  });

  it('rejects a malformed or overlong email', () => {
    expect(failedFields({ ...VALID, email: 'jo@' })).toEqual(['email']);
    // 254 is the longest valid address: 64-char local part + domain.
    const emailOfLength = (length: number) =>
      `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(length - 197)}.com`;
    expect(failedFields({ ...VALID, email: emailOfLength(254) })).toEqual([]);
    expect(failedFields({ ...VALID, email: emailOfLength(255) })).toEqual([
      'email',
    ]);
  });

  it('explains each problem in words the form can show as-is', () => {
    const messagesFor = (body: object) =>
      validateSync(toDto(body)).flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );
    expect(messagesFor({ ...VALID, email: 'jo@' })).toEqual([
      'Enter a valid email address.',
    ]);
    expect(messagesFor({ ...VALID, firstName: ' ' })).toEqual([
      'Enter your first name.',
    ]);
    expect(messagesFor({ ...VALID, message: 'a'.repeat(2001) })).toEqual([
      'Message must be 2000 characters or fewer.',
    ]);
  });

  it('requires country and refuses blank (whitespace-only) names', () => {
    expect(failedFields({ ...VALID, country: undefined })).toEqual(['country']);
    expect(failedFields({ ...VALID, firstName: '   ' })).toEqual(['firstName']);
  });

  it.each([
    ['firstName', 100],
    ['lastName', 100],
    ['company', 200],
    ['phone', 30],
    ['message', 2000],
  ])('limits %s to %i characters', (field, max) => {
    expect(failedFields({ ...VALID, [field]: 'a'.repeat(max) })).toEqual([]);
    expect(failedFields({ ...VALID, [field]: 'a'.repeat(max + 1) })).toEqual([
      field,
    ]);
  });

  it('no longer knows a Turnstile token (the HTTP pipe refuses it as unknown)', () => {
    expect(Object.keys(toDto(VALID))).not.toContain('turnstileToken');
  });

  it('accepts a filled honeypot, so the service can drop it quietly', () => {
    expect(failedFields({ ...VALID, website: 'http://spam.example' })).toEqual(
      [],
    );
  });
});
