// Per client IP (request.ip — see TRUST_PROXY_HOPS in main.ts when the API
// runs behind a load balancer). Counters live in this API instance's
// memory, so with several instances the limit applies per instance.
export const DEMO_REQUEST_THROTTLER = {
  name: 'demoRequests',
  ttl: 10 * 60 * 1000,
  limit: 5,
};
