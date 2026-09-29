// Role names the code depends on: the admin guard checks for Owner, and
// every self-serve signup gets Customer (seeded by 0004 / 0027). The admin
// Roles API refuses to rename or delete these.
export const OWNER_ROLE_NAME = 'Owner';
export const CUSTOMER_ROLE_NAME = 'Customer';

export const BUILT_IN_ROLE_NAMES = [OWNER_ROLE_NAME, CUSTOMER_ROLE_NAME];
