import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';

app.http('authMe', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const user = await sessionUser(request);
    return user ? json(200, { user }) : errorResponse(401, 'Authentication required');
  },
});
