import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { aggregateRankings } from '../shared/ranking.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';
import { listMovies, listRankings, replaceRanking } from '../shared/storage.js';

app.http('rankings', {
  methods: ['GET', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rankings',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const user = await sessionUser(request);
    if (!user) return errorResponse(401, 'Authentication required');

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => null) as { orderedMovieIds?: string[] } | null;
      const orderedMovieIds = body?.orderedMovieIds;
      if (!orderedMovieIds || !Array.isArray(orderedMovieIds)) return errorResponse(400, 'orderedMovieIds is required');
      if (new Set(orderedMovieIds).size !== orderedMovieIds.length) return errorResponse(400, 'Rankings cannot contain duplicates');
      const validIds = new Set((await listMovies()).map((movie) => movie.imdbId));
      if (orderedMovieIds.some((id) => !validIds.has(id))) return errorResponse(400, 'Rankings contain an unknown movie');
      await replaceRanking(user, orderedMovieIds);
    }

    const rankings = await listRankings();
    return json(200, { rankings, aggregate: aggregateRankings(rankings) });
  },
});
