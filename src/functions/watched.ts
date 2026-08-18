import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { isImdbId } from '../shared/imdb.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';
import { getMovie, setWatched } from '../shared/storage.js';

app.http('watched', {
  methods: ['PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'movies/{imdbId}/watched',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const user = await sessionUser(request);
    if (!user) return errorResponse(401, 'Authentication required');
    const imdbId = request.params.imdbId;
    if (!isImdbId(imdbId)) return errorResponse(400, 'A valid IMDb ID is required');
    if (!(await getMovie(imdbId))) return errorResponse(404, 'Movie was not found');
    await setWatched(user.userId, imdbId, request.method === 'PUT');
    return json(200, { imdbId, watched: request.method === 'PUT' });
  },
});
