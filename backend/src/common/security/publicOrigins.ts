import {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { getPortalOrigins } from './portalOrigins';

// Routes the marketing site (quiptechfield.com.au) calls without signing
// in. Only these get its origins; every other route keeps PORTAL_ORIGIN.
export const PUBLIC_ROUTE_PREFIX = '/public/';

// Comma-separated. Dev default: the landing app on localhost:3000.
export const getPublicOrigins = (): string[] =>
  (process.env.PUBLIC_CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isPublicRoute = (url: string | undefined) =>
  (url ?? '').startsWith(PUBLIC_ROUTE_PREFIX);

// Public routes: marketing-site origins, no cookies/credentials. All
// others: the portal, exactly as before.
export const corsOptionsForRequest: CorsOptionsDelegate<{ url?: string }> = (
  request,
  callback,
) => {
  const options: CorsOptions = isPublicRoute(request.url)
    ? { origin: getPublicOrigins(), methods: ['POST'], credentials: false }
    : { origin: getPortalOrigins(), credentials: true };
  callback(null, options);
};
