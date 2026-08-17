import type { HttpResponseInit } from '@azure/functions';

export function allowedOrigin(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173';
}

export function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowedOrigin(),
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
    jsonBody: body,
  };
}

export function errorResponse(status: number, message: string): HttpResponseInit {
  return json(status, { error: message });
}

export function optionsResponse(): HttpResponseInit {
  return { ...json(204, null), body: undefined, jsonBody: undefined };
}
