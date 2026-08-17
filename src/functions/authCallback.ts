import { app, type HttpResponseInit } from '@azure/functions';
import { createExchangeCode, discordUser, isGuildMember, parseCookie } from '../shared/auth.js';
import { allowedOrigin, errorResponse } from '../shared/response.js';
import { saveUser } from '../shared/storage.js';

app.http('authCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback',
  handler: async (request, context): Promise<HttpResponseInit> => {
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    if (request.query.get('error')) {
      const loginUrl = redirectUri?.replace('/auth/callback', '/auth/login') ?? '/api/auth/login';
      return { status: 302, headers: { Location: `${loginUrl}?consent=1` } };
    }

    const code = request.query.get('code');
    const state = request.query.get('state');
    const storedState = parseCookie(request.headers.get('cookie') ?? '', 'oauth_state');
    if (!code || !state || !storedState || state !== storedState) {
      return errorResponse(400, 'Invalid OAuth response');
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret || !redirectUri) return errorResponse(500, 'Authentication is not configured');

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
      });
      if (!tokenResponse.ok) {
        const discordError = await tokenResponse.text();
        context.error('Discord token exchange failed', {
          status: tokenResponse.status,
          response: discordError.slice(0, 500),
          redirectUri,
        });
        return errorResponse(401, 'Discord token exchange failed');
      }

      const { access_token: accessToken } = await tokenResponse.json() as { access_token: string };
      if (!(await isGuildMember(accessToken))) return errorResponse(403, 'Discord guild membership is required');

      const user = await discordUser(accessToken);
      await saveUser(user);
      const exchangeCode = await createExchangeCode(user);
      return {
        status: 302,
        headers: {
          Location: `${allowedOrigin()}/#code=${encodeURIComponent(exchangeCode)}`,
          'Set-Cookie': 'oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
        },
      };
    } catch (error) {
      context.error('Discord callback failed', error);
      return errorResponse(500, 'Authentication failed');
    }
  },
});
