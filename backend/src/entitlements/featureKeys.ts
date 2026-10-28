// The spec's feature keys (billing spec section 5). Every access check
// names one of these; code never compares plan names. Which plan grants
// which key is data (platform.plan_features, migration 0110).
export const FEATURE_KEYS = {
  aiAssistant: 'ai.assistant',
  knowledgeRead: 'knowledge.read',
  fleetRegister: 'fleet.register',
  fleetImport: 'fleet.import',
  assetHistory: 'asset.history',
  remoteSession: 'remote.session',
  orgUsersUnlimited: 'org.users.unlimited',
  ssoSaml: 'sso.saml',
  whitelabel: 'whitelabel',
  oemLicenceControls: 'oem.licence_controls',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_REQUIRED_CODE = 'feature_not_in_plan';

export const FEATURE_MESSAGES: Record<FeatureKey, string> = {
  'ai.assistant': "Your organisation's plan doesn't include the AI assistant.",
  'knowledge.read':
    "Your organisation's plan doesn't include the knowledge library.",
  'fleet.register':
    'Adding machines needs a FIELD Asset Professional or Enterprise plan.',
  'fleet.import':
    'Importing a fleet needs a FIELD Asset Professional or Enterprise plan.',
  'asset.history':
    'Full machine history needs a FIELD Asset Professional or Enterprise plan.',
  'remote.session': "Your organisation's plan doesn't include remote sessions.",
  'org.users.unlimited':
    'A FIELD Technician plan is for one named user. Move to FIELD Asset Professional to add your team.',
  'sso.saml': 'Single sign-on is part of FIELD Enterprise.',
  whitelabel: 'White labelling is part of FIELD Enterprise.',
  'oem.licence_controls': 'OEM licence controls are part of FIELD Enterprise.',
};
