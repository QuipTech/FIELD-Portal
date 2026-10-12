import { toDocumentDisplayTitle } from './documentDisplayTitle';

describe('toDocumentDisplayTitle', () => {
  it('turns a file name into a title', () => {
    expect(
      toDocumentDisplayTitle(
        'CAT_793F_Hydraulic_System_Maintenance_Bulletin (2).pdf',
      ),
    ).toBe('CAT 793F Hydraulic System Maintenance Bulletin');
    expect(toDocumentDisplayTitle('Komatsu 930E Manual - Copy.DOCX')).toBe(
      'Komatsu 930E Manual',
    );
  });

  it('leaves a typed title alone', () => {
    expect(
      toDocumentDisplayTitle('Suspension recharge (front, 2024 rev)'),
    ).toBe('Suspension recharge (front, 2024 rev)');
  });

  it('keeps the stored title when cleaning leaves nothing', () => {
    expect(toDocumentDisplayTitle('.pdf')).toBe('.pdf');
  });
});
