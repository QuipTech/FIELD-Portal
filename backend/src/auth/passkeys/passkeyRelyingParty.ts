import { getPortalOrigins } from '../../common/security/portalOrigins';

// A passkey only works on the site it was created for: its "relying party"
// ID is the portal's domain (WEBAUTHN_RP_ID, else the first PORTAL_ORIGIN's
// host), and a sign-in is accepted only from a PORTAL_ORIGIN page.
export const getPasskeyRelyingParty = () => {
  const origins = getPortalOrigins()
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    name: 'QuipTech FIELD',
    id: process.env.WEBAUTHN_RP_ID || new URL(origins[0]).hostname,
    origins,
  };
};
