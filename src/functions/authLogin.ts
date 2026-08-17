import { randomUUID } from 'node:crypto';
import { app } from '@azure/functions';
import { errorResponse } from '../shared/response.js';

app.http('authLogin', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async (request, context) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      context.error('Discord authentication is not configured');
      return errorResponse(500, 'Authentication is not configured');
    }

    const state = randomUUID();
    const parameters = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds.members.read',
      state,
      prompt: request.query.get('consent') === '1' ? 'consent' : 'none',
    });

    return {
      status: 302,
      headers: {
        Location: `https://discord.com/oauth2/authorize?${parameters}`,
        'Set-Cookie': `oauth_state=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
      },
    };
  },
});
