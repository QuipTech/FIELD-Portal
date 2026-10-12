import { escapeHtml } from '../common/utils/escapeHtml';

const ACCENT = '#4F39F6';
const EXCERPT_LENGTH = 600;

export interface CaseEmailContent {
  recipientFirstName: string;
  title: string;
  // The reply itself, or what changed.
  body: string;
  url: string;
}

// A support case email: inline-styled HTML (email clients ignore <style>)
// and the same content as plain text. Message text is user-typed, so it
// is escaped and trimmed.
export const buildCaseEmail = (
  content: CaseEmailContent,
): { subject: string; text: string; html: string } => {
  const body =
    content.body.length > EXCERPT_LENGTH
      ? `${content.body.slice(0, EXCERPT_LENGTH)}…`
      : content.body;
  const text = [
    `Hi ${content.recipientFirstName},`,
    '',
    content.title,
    '',
    body,
    '',
    `Open the case in FIELD: ${content.url}`,
  ].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${ACCENT};padding:16px 24px;color:#ffffff;font-size:16px;font-weight:bold">FIELD Support</td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px">Hi ${escapeHtml(content.recipientFirstName)},</p>
      <p style="margin:0 0 12px;font-size:17px;font-weight:bold">${escapeHtml(content.title)}</p>
      <p style="margin:0 0 20px;color:#4b5563;white-space:pre-wrap">${escapeHtml(body)}</p>
      <a href="${escapeHtml(content.url)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Open the case</a>
    </td></tr>
  </table>
</body></html>`;
  return { subject: content.title, text, html };
};
