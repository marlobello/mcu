import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allowedOrigin, errorResponse, json, optionsResponse } from './response.js';

const originalFrontendUrl = process.env.FRONTEND_URL;
const originalNodeEnv = process.env.NODE_ENV;
const originalFunctionsEnv = process.env.AZURE_FUNCTIONS_ENVIRONMENT;

beforeEach(() => {
  process.env.FRONTEND_URL = 'https://mcu.example.dev';
});

afterEach(() => {
  process.env.FRONTEND_URL = originalFrontendUrl;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalFunctionsEnv === undefined) delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;
  else process.env.AZURE_FUNCTIONS_ENVIRONMENT = originalFunctionsEnv;
});

describe('allowedOrigin', () => {
  it('uses the configured frontend URL without a trailing slash', () => {
    process.env.FRONTEND_URL = 'https://mcu.example.dev/';
    expect(allowedOrigin()).toBe('https://mcu.example.dev');
  });

  it('falls back to the dev origin outside production', () => {
    delete process.env.FRONTEND_URL;
    process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'Development';
    expect(allowedOrigin()).toBe('http://localhost:5173');
  });

  it('fails closed in production instead of allowing localhost', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;
    process.env.NODE_ENV = 'production';
    expect(() => allowedOrigin()).toThrow(/FRONTEND_URL/);
  });

  it('fails closed when the environment is not identified at all', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;
    delete process.env.NODE_ENV;
    expect(() => allowedOrigin()).toThrow(/FRONTEND_URL/);
  });
});

describe('responses', () => {
  it('marks token-bearing payloads as uncacheable', () => {
    expect(json(200, { token: 'x' }).headers).toMatchObject({ 'Cache-Control': 'no-store' });
    expect(errorResponse(401, 'nope').jsonBody).toEqual({ error: 'nope' });
  });

  it('lets browsers cache the preflight and sends no body', () => {
    const response = optionsResponse();
    expect(response.status).toBe(204);
    expect(response.headers).toMatchObject({ 'Access-Control-Max-Age': '600' });
    expect(response.jsonBody).toBeUndefined();
    expect(response.body).toBeUndefined();
  });
});
