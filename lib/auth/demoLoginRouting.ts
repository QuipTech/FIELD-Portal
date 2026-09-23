const ADMIN_DEMO_EMAIL = "uneebmalik99+1@gmail.com";
const CUSTOMER_DEMO_EMAIL = "uneebmalik99@gmail.com";

const DEFAULT_ROUTE = "/dashboard";
const ADMIN_ROUTE = "/admin/dashboard";

/**
 * Frontend-only routing for the demo login — no backend call. Real role-based
 * redirects belong server-side once auth exists; this only unblocks demoing
 * both the customer and admin dashboards from the same login screen.
 */
export const resolvePostLoginRoute = (email: string): string => {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === ADMIN_DEMO_EMAIL) {
    return ADMIN_ROUTE;
  }

  if (normalizedEmail === CUSTOMER_DEMO_EMAIL) {
    return DEFAULT_ROUTE;
  }

  return DEFAULT_ROUTE;
};
