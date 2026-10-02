import { AlertMessage } from './types/alertTypes';

const DEFAULT_ACCENT = '#4F39F6';
const HEX_COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Branding colours are admin-typed, so only a plain hex colour reaches
// the style attribute.
const toSafeColor = (color: string | null) =>
  color && HEX_COLOR.test(color) ? color : DEFAULT_ACCENT;

// An alert email: inline-styled HTML (email clients ignore <style>) in the
// organisation's accent colour, and the same content as plain text.
export const buildAlertEmail = (
  message: AlertMessage,
  recipientFirstName: string,
): { subject: string; text: string; html: string } => {
  const accent = toSafeColor(message.accentColor);
  const footer = `You get this because of the "${message.ruleName}" alert rule in ${message.organisationName}'s FIELD settings.`;
  const text = [
    `Hi ${recipientFirstName},`,
    '',
    message.title,
    message.body,
    '',
    `Open in FIELD: ${message.url}`,
    '',
    footer,
  ].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${accent};padding:16px 24px;color:#ffffff;font-size:16px;font-weight:bold">${escapeHtml(message.organisationName)} · FIELD</td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 12px">Hi ${escapeHtml(recipientFirstName)},</p>
      <p style="margin:0 0 8px;font-size:17px;font-weight:bold">${escapeHtml(message.title)}</p>
      <p style="margin:0 0 20px;color:#4b5563">${escapeHtml(message.body)}</p>
      <a href="${escapeHtml(message.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Open in FIELD</a>
    </td></tr>
    <tr><td style="padding:16px 24px;font-size:12px;color:#9ca3af">${escapeHtml(footer)}</td></tr>
  </table>
</body></html>`;
  return { subject: message.title, text, html };
};
