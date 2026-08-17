import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { aggregateWatched } from '../shared/watchedSummary.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';
import { listAllWatched, listMovies } from '../shared/storage.js';

app.http('watchedSummary', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'watched',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    if (!(await sessionUser(request))) return errorResponse(401, 'Authentication required');

    const validMovieIds = new Set((await listMovies()).map((movie) => movie.imdbId));
    const watched = (await listAllWatched()).filter((entry) => validMovieIds.has(entry.imdbId));
    return json(200, { community: aggregateWatched(watched) });
  },
});
