import { app } from '@azure/functions';
import { sessionUser } from '../shared/auth.js';
import { errorResponse, json, optionsResponse } from '../shared/response.js';
import { getMovie, listWatched, setShelf } from '../shared/storage.js';

app.http('shelf', {
  methods: ['PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'movies/{imdbId}/shelf',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return optionsResponse();
    const user = await sessionUser(request);
    if (!user) return errorResponse(401, 'Authentication required');
    const imdbId = request.params.imdbId;
    if (!(await getMovie(imdbId))) return errorResponse(404, 'Movie was not found');

    const onShelf = request.method === 'PUT';
    if (!onShelf && (await listWatched(user.userId)).includes(imdbId)) {
      return errorResponse(409, 'Watched movies must remain on your movie shelf');
    }

    await setShelf(user.userId, imdbId, onShelf);
    return json(200, { imdbId, onShelf });
  },
});
