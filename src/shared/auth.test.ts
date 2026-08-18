import { decodeJwt } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const claimExchangeCode = vi.fn();

vi.mock('./storage.js', () => ({ claimExchangeCode }));

const { createExchangeCode, redeemExchangeCode, signSession } = await import('./auth.js');

const originalSecret = process.env.SESSION_SECRET;
const user = { userId: 'user-1', username: 'Leia', avatar: null };

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters';
  claimExchangeCode.mockReset();
});

afterEach(() => {
  process.env.SESSION_SECRET = originalSecret;
});

describe('signed sessions', () => {
  it('lasts for 30 days', async () => {
    const payload = decodeJwt(await signSession(user));

    expect(payload.exp! - payload.iat!).toBe(30 * 24 * 60 * 60);
  });
});

describe('exchange codes', () => {
  it('carries a unique identifier so redemption can be tracked', async () => {
    const [first, second] = await Promise.all([createExchangeCode(user), createExchangeCode(user)]);

    expect(decodeJwt(first).jti).toBeTypeOf('string');
    expect(decodeJwt(first).jti).not.toBe(decodeJwt(second).jti);
  });

  it('is accepted once and rejected when replayed', async () => {
    const code = await createExchangeCode(user);
    claimExchangeCode.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(redeemExchangeCode(code)).resolves.toEqual(user);
    await expect(redeemExchangeCode(code)).resolves.toBeNull();
    expect(claimExchangeCode).toHaveBeenCalledTimes(2);
  });

  it('rejects a session token presented as an exchange code', async () => {
    await expect(redeemExchangeCode(await signSession(user))).resolves.toBeNull();
    expect(claimExchangeCode).not.toHaveBeenCalled();
  });
});
