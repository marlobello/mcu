import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { HttpRequest } from '@azure/functions';
import { claimExchangeCode } from './storage.js';
import type { SessionUser } from './types.js';

const issuer = 'munch-classics-universe-api';
const audience = 'munch-classics-universe';

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user, type: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime('30d')
    .sign(secret());
}

export async function createExchangeCode(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user, type: 'exchange' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setJti(randomUUID())
    .setExpirationTime('60s')
    .sign(secret());
}

async function verify(token: string, type: 'session' | 'exchange'): Promise<SessionUser | null> {
  return (await verifyPayload(token, type))?.user ?? null;
}

async function verifyPayload(
  token: string,
  type: 'session' | 'exchange',
): Promise<{ user: SessionUser; jti?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer, audience });
    if (payload.type !== type || !payload.userId || !payload.username) return null;
    return {
      user: {
        userId: String(payload.userId),
        username: String(payload.username),
        avatar: payload.avatar ? String(payload.avatar) : null,
      },
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}

/** Exchange codes are single-use: a valid signature is not enough if the code was already redeemed. */
export async function redeemExchangeCode(code: string): Promise<SessionUser | null> {
  const verified = await verifyPayload(code, 'exchange');
  if (!verified?.jti) return null;
  return (await claimExchangeCode(verified.jti)) ? verified.user : null;
}

export async function sessionUser(request: HttpRequest): Promise<SessionUser | null> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  return verify(authorization.slice(7), 'session');
}

export function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

const discordApiBase = 'https://discord.com/api/v10';
const discordTimeoutMs = 8000;

export class DiscordUnavailableError extends Error {}

async function discordFetch(path: string, accessToken: string): Promise<Response> {
  try {
    return await fetch(`${discordApiBase}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(discordTimeoutMs),
    });
  } catch (error) {
    throw new DiscordUnavailableError(`Discord request to ${path} failed`, { cause: error });
  }
}

export async function discordUser(accessToken: string): Promise<SessionUser> {
  const response = await discordFetch('/users/@me', accessToken);
  if (!response.ok) throw new DiscordUnavailableError(`Discord user request failed with ${response.status}`);
  const user = await response.json() as { id: string; username: string; avatar: string | null };
  return { userId: user.id, username: user.username, avatar: user.avatar };
}

/**
 * Resolves guild membership. Only an explicit 404 means "not a member" — a Discord outage
 * throws so the caller can report a retryable failure instead of a misleading denial.
 */
export async function isGuildMember(accessToken: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('DISCORD_GUILD_ID is required');
  const response = await discordFetch(`/users/@me/guilds/${encodeURIComponent(guildId)}/member`, accessToken);
  if (response.ok) return true;
  if (response.status === 404 || response.status === 403) return false;
  throw new DiscordUnavailableError(`Discord guild membership check failed with ${response.status}`);
}

export type SessionPayload = JWTPayload & SessionUser;
