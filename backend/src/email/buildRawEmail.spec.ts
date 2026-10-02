import { buildRawEmail } from './buildRawEmail';

const decodeBase64 = (text: string) =>
  Buffer.from(text.replace(/\r\n/g, ''), 'base64').toString('utf8');

const SENDER = { address: 'reports@example.com', name: 'FIELD' };

describe('buildRawEmail', () => {
  it('encodes the subject so a typed name cannot add headers', () => {
    const message = buildRawEmail(
      {
        to: 'ops@example.com',
        subject: 'Weekly fleet\r\nBcc: attacker@example.com',
        text: 'Attached.',
      },
      SENDER,
      'b1',
    );
    expect(message).not.toMatch(/^Bcc:/m);
    const encoded = /^Subject: =\?UTF-8\?B\?(.+)\?=$/m.exec(message)?.[1] ?? '';
    expect(decodeBase64(encoded)).toBe(
      'Weekly fleet\r\nBcc: attacker@example.com',
    );
  });

  it('attaches a file', () => {
    const message = buildRawEmail(
      {
        to: 'ops@example.com',
        subject: 'Report',
        text: 'Attached.',
        attachment: {
          fileName: 'fleet-uptime-2026-10-02.csv',
          contentType: 'text/csv',
          content: 'Organisation,Site\r\nTRT,Pit 4\r\n',
        },
      },
      SENDER,
      'b1',
    );
    expect(message).toContain(
      'Content-Disposition: attachment; filename="fleet-uptime-2026-10-02.csv"',
    );
    const attachment = message.split('--b1')[2].split('\r\n\r\n')[1];
    expect(decodeBase64(attachment)).toBe('Organisation,Site\r\nTRT,Pit 4\r\n');
  });

  it('sends HTML with a plain-text alternative', () => {
    const message = buildRawEmail(
      {
        to: 'a@example.com',
        subject: 'Alert',
        text: 'Plain',
        html: '<p>Rich</p>',
      },
      SENDER,
      'b1',
    );
    expect(message).toContain('multipart/alternative; boundary="b1-alt"');
    expect(message).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(message).toContain('Content-Type: text/html; charset=UTF-8');
  });
});
