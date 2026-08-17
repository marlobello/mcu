import { app } from '@azure/functions';
import { redeemExchangeCode, signSession } from '../shared/auth.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';

app.http('authExchange', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/exchange',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const body = await request.json().catch(() => null) as { code?: string } | null;
    if (!body?.code) return errorResponse(400, 'Exchange code is required');
    const user = await redeemExchangeCode(body.code);
    if (!user) return errorResponse(401, 'Exchange code is invalid or expired');
    return json(200, { token: await signSession(user), user });
  },
});
