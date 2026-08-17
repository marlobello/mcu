import { app } from '@azure/functions';
import { json } from '../shared/response.js';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => json(200, { status: 'ok' }),
});
