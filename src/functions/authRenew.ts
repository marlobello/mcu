import { app } from '@azure/functions';
import { sessionUser, signSession } from '../shared/auth.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';

app.http('authRenew', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/renew',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const user = await sessionUser(request);
    if (!user) return errorResponse(401, 'Authentication required');
    return json(200, { token: await signSession(user) });
  },
});
