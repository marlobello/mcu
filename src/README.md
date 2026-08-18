# API

The API is an Azure Functions v4 TypeScript application.

## Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Health probe |
| GET | `/api/auth/login` | Start Discord OAuth |
| GET | `/api/auth/callback` | Complete Discord OAuth |
| POST | `/api/auth/exchange` | Exchange callback code for a session |
| GET | `/api/auth/me` | Validate the current session |
| GET/POST | `/api/movies` | List or create movies |
| GET | `/api/movies/search?q=` | Search TMDB, flagging titles already in the catalog |
| POST | `/api/movies/refresh` | Function-key-protected TMDB metadata refresh |
| PUT/DELETE | `/api/movies/{imdbId}/shelf` | Set personal movie-shelf membership |
| PUT/DELETE | `/api/movies/{imdbId}/watched` | Set watched status |
| POST | `/api/auth/renew` | Renew a session that is close to expiry |
| GET | `/api/watched` | Aggregate unique watcher counts and shared ranks |

All business routes except the metadata refresh require a bearer session token. The refresh route requires an Azure Functions function key.

## Layout

- `functions`: HTTP trigger registration and request handling
- `shared/auth.ts`: Discord and session logic
- `shared/storage.ts`: Table Storage repository
- `shared/tmdb.ts`: TMDB metadata, certification, IMDb lookup, and poster integration
- `shared/watchedSummary.ts`: unique-watcher aggregation and dense shared ranks
- `shared/imdb.ts`: IMDb ID validation shared by route handlers and TMDB parsing
- `shared/response.ts`: CORS, cache, and security headers for every response
