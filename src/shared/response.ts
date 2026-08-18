import type { HttpResponseInit } from '@azure/functions';

const developmentOrigin = 'http://localhost:5173';
const preflightMaxAgeSeconds = '600';

function isDevelopment(): boolean {
  // Azure Functions sets AZURE_FUNCTIONS_ENVIRONMENT, and NODE_ENV is not guaranteed to be set in
  // the cloud, so anything that is not explicitly a local or test run is treated as production.
  return process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test';
}

/**
 * Resolves the single browser origin permitted to call the API. Production must configure
 * FRONTEND_URL explicitly; falling back to a localhost origin there would silently widen CORS.
 */
export function allowedOrigin(): string {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (isDevelopment()) return developmentOrigin;
  throw new Error('FRONTEND_URL is required');
}

function baseHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': preflightMaxAgeSeconds,
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

export function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...baseHeaders() },
    jsonBody: body,
  };
}

export function errorResponse(status: number, message: string): HttpResponseInit {
  return json(status, { error: message });
}

export function optionsResponse(): HttpResponseInit {
  return { status: 204, headers: baseHeaders() };
}

/** Sends a browser navigation back to the single-page app, optionally reporting a failure. */
export function frontendRedirect(fragment = '', extraHeaders: Record<string, string> = {}): HttpResponseInit {
  return {
    status: 302,
    headers: {
      Location: `${allowedOrigin()}/${fragment}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  };
}
