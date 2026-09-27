import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SyncCognitoDto } from './syncCognitoDto';

const validate = (body: object) =>
  validateSync(plainToInstance(SyncCognitoDto, body));

describe('SyncCognitoDto', () => {
  it('accepts an empty body (returning user)', () => {
    expect(validate({})).toHaveLength(0);
  });

  it('accepts a company name and a formatted phone number', () => {
    expect(
      validate({ companyName: ' Acme ', phoneNumber: '+61 (400) 000-000' }),
    ).toHaveLength(0);
  });

  it('rejects a phone number with letters', () => {
    expect(validate({ phoneNumber: 'call me' })).not.toHaveLength(0);
  });

  it('rejects a blank company name', () => {
    expect(validate({ companyName: '   ' })).not.toHaveLength(0);
  });
});
