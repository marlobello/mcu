import { app } from '@azure/functions';
import { errorResponse, json } from '../shared/response.js';
import { listMovies, replaceMovie } from '../shared/storage.js';
import { refreshMovieFromTmdb } from '../shared/tmdb.js';

app.http('movieRefresh', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'movies/refresh',
  handler: async (_request, context) => {
    const refreshed: string[] = [];
    const unmatched: string[] = [];
    const failed: string[] = [];

    try {
      for (const movie of await listMovies()) {
        try {
          const replacement = await refreshMovieFromTmdb(movie);
          if (!replacement) {
            unmatched.push(movie.imdbId);
            continue;
          }
          await replaceMovie(replacement);
          refreshed.push(movie.imdbId);
        } catch (error) {
          context.error(`TMDB refresh failed for ${movie.imdbId}`, error);
          failed.push(movie.imdbId);
        }
      }
    } catch (error) {
      context.error('Movie refresh could not read the catalog', error);
      return errorResponse(500, 'Movie catalog refresh failed');
    }

    const status = unmatched.length || failed.length ? 207 : 200;
    return json(status, { refreshed, unmatched, failed });
  },
});
