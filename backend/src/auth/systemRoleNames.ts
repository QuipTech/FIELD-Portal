// Role names the code depends on: Owner is the platform administrator
// (sees and manages every organisation in the admin portal), and every
// self-serve signup gets Customer (seeded by 0004 / 0027). Both are default
// roles (roles.is_default, 0062), which can't be renamed or deleted.
export const OWNER_ROLE_NAME = 'Owner';
export const CUSTOMER_ROLE_NAME = 'Customer';

// The permission that makes someone a platform administrator. Only the
// Owner role can hold it (enforced by a trigger, migration 0055).
export const PLATFORM_PERMISSION_CODE = 'platform.manage';
