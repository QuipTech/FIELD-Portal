import { escapeHtml } from '../../common/utils/escapeHtml';
import { DemoRequestRow } from '../types/demoRequestRows';
import { BuiltEmail, wrapInLayout } from './demoEmailLayout';

const SUBJECT = 'Thanks for requesting a QuipTech FIELD demo';
const FOOTER =
  'You received this because you requested a demo at quiptechfield.com.au.';

// To the person who filled in the form.
export const buildRequesterConfirmationEmail = (
  request: DemoRequestRow,
): BuiltEmail => {
  const paragraphs = [
    `Thanks for your interest in QuipTech FIELD. We've received your demo request for ${request.company}.`,
    'Someone from our team will contact you shortly to arrange a time that suits you.',
    'If you have anything to add in the meantime, just reply to this email.',
  ];
  const text = [
    `Hi ${request.first_name},`,
    '',
    ...paragraphs.flatMap((paragraph) => [paragraph, '']),
    'The QuipTech FIELD team',
    '',
    FOOTER,
  ].join('\n');
  const html = wrapInLayout(
    [
      `<p style="margin:0 0 12px">Hi ${escapeHtml(request.first_name)},</p>`,
      ...paragraphs.map(
        (paragraph) =>
          `<p style="margin:0 0 12px;color:#4b5563">${escapeHtml(paragraph)}</p>`,
      ),
      '<p style="margin:16px 0 0">The QuipTech FIELD team</p>',
    ].join('\n      '),
    FOOTER,
  );
  return { subject: SUBJECT, text, html };
};
