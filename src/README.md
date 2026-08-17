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
| GET | `/api/movies/search?q=` | Search MCU and Wikidata |
| PUT/DELETE | `/api/movies/{imdbId}/watched` | Set watched status |
| GET/PUT | `/api/rankings` | Read or replace rankings |

All routes except health and OAuth require a bearer session token.

## Layout

- `functions`: HTTP trigger registration and request handling
- `shared/auth.ts`: Discord and session logic
- `shared/storage.ts`: Table Storage repository
- `shared/wikidata.ts`: no-key metadata integration
- `shared/ranking.ts`: aggregate-ranking algorithm
