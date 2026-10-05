import { escapeHtml } from '../../common/utils/escapeHtml';
import { DemoRequestRow } from '../types/demoRequestRows';
import {
  BuiltEmail,
  htmlButton,
  htmlDetailRows,
  wrapInLayout,
} from './demoEmailLayout';

const NOT_GIVEN = '—';
const UNSAVED_NOTE =
  'This request could not be saved to the portal, so this email is the only record of it.';

// What the requester submitted; a saved row has all of these.
export type DemoRequestDetails = Pick<
  DemoRequestRow,
  | 'email'
  | 'first_name'
  | 'last_name'
  | 'company'
  | 'country'
  | 'phone'
  | 'message'
  | 'created_at'
>;
const FOOTER =
  'Sent by the FIELD portal for a demo request from quiptechfield.com.au. Reply to this email to answer the requester directly.';

// To the team (DEMO_NOTIFY_EMAIL). Sent with Reply-To set to the
// requester, so "Reply" in any inbox goes straight to them. requestUrl is
// null when the request couldn't be saved (there's nothing to link to).
export const buildTeamNotificationEmail = (
  request: DemoRequestDetails,
  requestUrl: string | null,
): BuiltEmail => {
  const fullName = `${request.first_name} ${request.last_name}`;
  const details: [string, string][] = [
    ['Name', fullName],
    ['Email', request.email],
    ['Company', request.company],
    ['Country', request.country],
    ['Phone', request.phone ?? NOT_GIVEN],
    ['Message', request.message ?? NOT_GIVEN],
    ['Received', request.created_at.toISOString()],
  ];
  const text = [
    `New demo request from ${fullName} (${request.company}).`,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    requestUrl ? `Open in the portal: ${requestUrl}` : UNSAVED_NOTE,
    '',
    FOOTER,
  ].join('\n');
  const html = wrapInLayout(
    `<p style="margin:0 0 16px;font-size:17px;font-weight:bold">New demo request from ${escapeHtml(fullName)}</p>
      <table role="presentation" style="margin:0 0 20px;font-size:14px;border-collapse:collapse">${htmlDetailRows(details)}</table>
      ${requestUrl ? htmlButton(requestUrl, 'Open in the portal') : `<p style="margin:0;color:#b45309">${escapeHtml(UNSAVED_NOTE)}</p>`}`,
    FOOTER,
  );
  return { subject: `New demo request: ${request.company}`, text, html };
};
