const CUSTOMER_ROUTE = "/dashboard";
const ADMIN_ROUTE = "/admin/dashboard";

// Roles that land on the admin portal instead of the customer dashboard.
const ADMIN_PORTAL_ROLES = ["Owner"];

// `roles` is undefined for a session saved before the backend started
// sending roles; that user gets the customer dashboard until they sign in again.
export const resolvePostLoginRoute = (roles: string[] | undefined): string =>
  roles?.some((role) => ADMIN_PORTAL_ROLES.includes(role)) ? ADMIN_ROUTE : CUSTOMER_ROUTE;
