import { app, type HttpResponseInit } from '@azure/functions';
import { createExchangeCode, discordUser, DiscordUnavailableError, isGuildMember, parseCookie } from '../shared/auth.js';
import { allowedOrigin, frontendRedirect } from '../shared/response.js';
import { saveUser } from '../shared/storage.js';

const clearStateCookie = 'oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
const discordTimeoutMs = 8000;

/**
 * The callback is reached by a top-level browser navigation, so every outcome must redirect back to
 * the single-page app. Returning JSON here would leave the user staring at a raw error body.
 */
function failure(reason: string): HttpResponseInit {
  return frontendRedirect(`#error=${encodeURIComponent(reason)}`, { 'Set-Cookie': clearStateCookie });
}

app.http('authCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback',
  handler: async (request, context): Promise<HttpResponseInit> => {
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    if (request.query.get('error')) {
      const loginUrl = redirectUri?.replace('/auth/callback', '/auth/login') ?? '/api/auth/login';
      return { status: 302, headers: { Location: `${loginUrl}?consent=1`, 'Cache-Control': 'no-store' } };
    }

    const code = request.query.get('code');
    const state = request.query.get('state');
    const storedState = parseCookie(request.headers.get('cookie') ?? '', 'oauth_state');
    if (!code || !state || !storedState || state !== storedState) {
      return failure('Sign-in could not be verified. Please try again.');
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret || !redirectUri) {
      context.error('Discord authentication is not configured');
      return failure('Authentication is not configured.');
    }

    try {
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(discordTimeoutMs),
      });
      if (!tokenResponse.ok) {
        const discordError = await tokenResponse.text();
        context.error('Discord token exchange failed', {
          status: tokenResponse.status,
          response: discordError.slice(0, 500),
          redirectUri,
        });
        return failure('Discord sign-in failed. Please try again.');
      }

      const { access_token: accessToken } = await tokenResponse.json() as { access_token: string };
      if (!(await isGuildMember(accessToken))) {
        return failure('Access is limited to members of the configured Discord community.');
      }

      const user = await discordUser(accessToken);
      await saveUser(user);
      const exchangeCode = await createExchangeCode(user);
      return {
        status: 302,
        headers: {
          Location: `${allowedOrigin()}/#code=${encodeURIComponent(exchangeCode)}`,
          'Cache-Control': 'no-store',
          'Set-Cookie': clearStateCookie,
        },
      };
    } catch (error) {
      context.error('Discord callback failed', error);
      return failure(error instanceof DiscordUnavailableError
        ? 'Discord is unavailable right now. Please try again in a moment.'
        : 'Authentication failed. Please try again.');
    }
  },
});
