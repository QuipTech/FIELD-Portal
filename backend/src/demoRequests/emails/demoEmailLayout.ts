import { escapeHtml } from '../../common/utils/escapeHtml';

export const BRAND_COLOR = '#4A34C7';

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

// Label/value rows for the team email; values are escaped here and line
// breaks kept (a typed message can span lines).
export const htmlDetailRows = (rows: [string, string][]): string =>
  rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111827">${escapeHtml(value).replace(/\r?\n/g, '<br>')}</td></tr>`,
    )
    .join('');

export const htmlButton = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">${escapeHtml(label)}</a>`;

// QuipTech FIELD's email shell: inline styles only (email clients ignore
// <style>). `body` is HTML the caller has already escaped.
export const wrapInLayout = (body: string, footer: string): string =>
  `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${BRAND_COLOR};padding:16px 24px;color:#ffffff;font-size:16px;font-weight:bold">QuipTech FIELD</td></tr>
    <tr><td style="padding:24px">${body}</td></tr>
    <tr><td style="padding:16px 24px;font-size:12px;color:#9ca3af">${escapeHtml(footer)}</td></tr>
  </table>
</body></html>`;
