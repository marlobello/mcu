import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';
import { listMovies } from '../shared/storage.js';
import { searchTmdbMovies } from '../shared/tmdb.js';

app.http('movieSearch', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'movies/search',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    if (!(await sessionUser(request))) return errorResponse(401, 'Authentication required');
    const query = request.query.get('q')?.trim() ?? '';
    if (query.length < 2 || query.length > 100) return errorResponse(400, 'Search must contain 2 to 100 characters');

    const local = (await listMovies()).filter((movie) => movie.title.toLowerCase().includes(query.toLowerCase()));
    try {
      const existingIds = new Set(local.map((movie) => movie.imdbId));
      const external = (await searchTmdbMovies(query)).map((movie) => ({
        ...movie,
        alreadyAdded: existingIds.has(movie.imdbId),
      }));
      return json(200, { local, external });
    } catch (error) {
      context.error('TMDB search failed', error);
      return errorResponse(502, 'Movie metadata provider is unavailable');
    }
  },
});
