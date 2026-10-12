const CUSTOMER_ROUTE = "/dashboard";
const ADMIN_ROUTE = "/admin/dashboard";
const SUPPORT_QUEUE_ROUTE = "/admin/cases";

// Roles that land on the admin portal instead of the customer dashboard.
// A Support Agent's admin portal is just the support queue.
const ADMIN_PORTAL_ROLES = ["Owner"];
const SUPPORT_STAFF_ROLES = ["Support Agent"];

// `roles` is undefined for a session saved before the backend started
// sending roles; that user gets the customer dashboard until they sign in again.
export const resolvePostLoginRoute = (roles: string[] | undefined): string => {
  if (roles?.some((role) => ADMIN_PORTAL_ROLES.includes(role))) return ADMIN_ROUTE;
  if (roles?.some((role) => SUPPORT_STAFF_ROLES.includes(role))) return SUPPORT_QUEUE_ROUTE;
  return CUSTOMER_ROUTE;
};
