import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';
import { createMovie, getMovie, listMovies, listWatched } from '../shared/storage.js';
import { getTmdbMovie, TmdbApiError } from '../shared/tmdb.js';

app.http('movies', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'movies',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const user = await sessionUser(request);
    if (!user) return errorResponse(401, 'Authentication required');

    if (request.method === 'GET') {
      return json(200, { movies: await listMovies(), watchedMovieIds: await listWatched(user.userId) });
    }

    const body = await request.json().catch(() => null) as { tmdbId?: unknown } | null;
    const tmdbId = body?.tmdbId;
    if (typeof tmdbId !== 'number' || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return errorResponse(400, 'A valid TMDB movie ID is required');
    }

    try {
      const movie = await getTmdbMovie(tmdbId, user.userId, user.username);
      if (!movie) return errorResponse(404, 'A movie with an IMDb ID was not found');
      if (await getMovie(movie.imdbId)) return errorResponse(409, 'That movie already exists');
      await createMovie(movie);
      return json(201, { movie });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error
        && (error as { statusCode?: number }).statusCode === 409) {
        return errorResponse(409, 'That movie already exists');
      }
      context.error('Movie creation failed', error);
      if (error instanceof TmdbApiError) return errorResponse(502, 'Movie metadata provider is unavailable');
      return errorResponse(500, 'Movie could not be added');
    }
  },
});
