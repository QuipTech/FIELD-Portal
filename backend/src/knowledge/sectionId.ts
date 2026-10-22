// "4.3 Hydraulic pump", "4.3. Pump", "12) Torque" — the number the manual
// itself uses. Single numbers need their "." or ")" so "2 Check valve"
// (a table row taken for a heading) doesn't become section "2".
const NUMBERED_HEADING = /^(\d+(?:\.\d+)+|\d+(?=[.)]))[.)]?\s/;

// The article anchor the portal links to (/knowledge/:id#s{ordinal}).
export const toSectionAnchor = (ordinal: number): string => `s${ordinal}`;

// What the app and AI citations call a section: the manual's own number
// when the heading has one, otherwise the anchor.
export const toSectionId = (ordinal: number, heading: string | null): string =>
  heading?.trim().match(NUMBERED_HEADING)?.[1] ?? toSectionAnchor(ordinal);
