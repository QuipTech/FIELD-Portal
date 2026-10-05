import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateDemoRequestDto } from './createDemoRequestDto';

const VALID = {
  email: 'jo@acme.com',
  firstName: 'Jo',
  lastName: 'Bloggs',
  company: 'Acme Mining',
  country: 'Australia',
  turnstileToken: 'token',
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

  it('rejects a malformed email', () => {
    expect(failedFields({ ...VALID, email: 'jo@' })).toEqual(['email']);
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

  it('requires the Turnstile token', () => {
    expect(failedFields({ ...VALID, turnstileToken: '' })).toEqual([
      'turnstileToken',
    ]);
  });

  it('accepts a filled honeypot, so the service can drop it quietly', () => {
    expect(failedFields({ ...VALID, website: 'http://spam.example' })).toEqual(
      [],
    );
  });
});
