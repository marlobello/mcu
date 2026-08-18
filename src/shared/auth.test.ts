import { decodeJwt } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signSession } from './auth.js';

const originalSecret = process.env.SESSION_SECRET;

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters';
});

afterEach(() => {
  process.env.SESSION_SECRET = originalSecret;
});

describe('signed sessions', () => {
  it('lasts for 30 days', async () => {
    const payload = decodeJwt(await signSession({
      userId: 'user-1',
      username: 'Leia',
      avatar: null,
    }));

    expect(payload.exp! - payload.iat!).toBe(30 * 24 * 60 * 60);
  });
});
