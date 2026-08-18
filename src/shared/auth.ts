import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { HttpRequest } from '@azure/functions';
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
    .setExpirationTime('60s')
    .sign(secret());
}

async function verify(token: string, type: 'session' | 'exchange'): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer, audience });
    if (payload.type !== type || !payload.userId || !payload.username) return null;
    return {
      userId: String(payload.userId),
      username: String(payload.username),
      avatar: payload.avatar ? String(payload.avatar) : null,
    };
  } catch {
    return null;
  }
}

export async function redeemExchangeCode(code: string): Promise<SessionUser | null> {
  return verify(code, 'exchange');
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

export async function discordUser(accessToken: string): Promise<SessionUser> {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Discord user request failed with ${response.status}`);
  const user = await response.json() as { id: string; username: string; avatar: string | null };
  return { userId: user.id, username: user.username, avatar: user.avatar };
}

export async function isGuildMember(accessToken: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('DISCORD_GUILD_ID is required');
  const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.ok;
}

export type SessionPayload = JWTPayload & SessionUser;
