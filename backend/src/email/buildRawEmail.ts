import { OutgoingEmail } from './types/outgoingEmail';

// A raw MIME message for SES SendEmail (Raw): text with an optional HTML
// alternative and an optional attachment. Built by hand to avoid a mail
// library for these fixed shapes.

const MIME_LINE_LENGTH = 76;

// RFC 2047 encoded-word: any characters (and no header injection) in
// display names and subjects, which include user-typed names.
const encodeHeaderText = (text: string) =>
  `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;

// Reply-To carries a user-typed address: only a bare address with no
// whitespace, brackets or quotes reaches the header, so it can't add one.
const SAFE_ADDRESS = /^[^\s<>"',;]+@[^\s<>"',;]+$/;

const replyToHeader = (replyTo: string | undefined): string[] =>
  replyTo && SAFE_ADDRESS.test(replyTo) ? [`Reply-To: ${replyTo}`] : [];

const toBase64Lines = (content: string) =>
  (
    Buffer.from(content, 'utf8')
      .toString('base64')
      .match(new RegExp(`.{1,${MIME_LINE_LENGTH}}`, 'g')) ?? []
  ).join('\r\n');

const base64Part = (headers: string[], content: string) => [
  ...headers,
  'Content-Transfer-Encoding: base64',
  '',
  toBase64Lines(content),
];

const bodyPart = (email: OutgoingEmail, boundary: string): string[] => {
  const textPart = base64Part(
    ['Content-Type: text/plain; charset=UTF-8'],
    email.text,
  );
  if (!email.html) return textPart;
  const alternative = `${boundary}-alt`;
  return [
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    '',
    `--${alternative}`,
    ...textPart,
    `--${alternative}`,
    ...base64Part(['Content-Type: text/html; charset=UTF-8'], email.html),
    `--${alternative}--`,
  ];
};

export const buildRawEmail = (
  email: OutgoingEmail,
  sender: { address: string; name: string },
  boundary: string,
): string => {
  const { attachment } = email;
  const attachmentPart = attachment
    ? [
        `--${boundary}`,
        ...base64Part(
          [
            `Content-Type: ${attachment.contentType}; charset=UTF-8; name="${attachment.fileName}"`,
            `Content-Disposition: attachment; filename="${attachment.fileName}"`,
          ],
          attachment.content,
        ),
      ]
    : [];
  return [
    `From: ${encodeHeaderText(sender.name)} <${sender.address}>`,
    `To: ${email.to}`,
    ...replyToHeader(email.replyTo),
    `Subject: ${encodeHeaderText(email.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    ...bodyPart(email, boundary),
    ...attachmentPart,
    `--${boundary}--`,
    '',
  ].join('\r\n');
};
