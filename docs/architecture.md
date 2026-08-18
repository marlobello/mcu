# Architecture

MCU uses a low-idle-cost Azure architecture: a static React client, a scale-to-zero Functions API, and Azure Table Storage.

## Request flow

1. The browser loads the React application from Azure Static Web Apps.
2. Sign-in redirects to Discord through the Functions API.
3. The callback validates OAuth state and Discord guild membership.
4. The API issues a short-lived, single-use exchange code; the browser exchanges it for a 30-day signed session token.
5. Authenticated API requests use the bearer token. Sessions with fewer than seven days remaining are silently renewed after successful startup validation.
6. The client clears a saved session only after an HTTP 401 response. Transient network and server failures preserve the token and expose a Retry action.
7. The Function App uses its user-assigned managed identity for Table Storage and Key Vault.

## Data model

| Table | Partition key | Row key | Purpose |
|-------|---------------|---------|---------|
| `Movies` | `movie` | IMDb title ID | Shared movie metadata |
| `Users` | `user` | Discord user ID | Display name and avatar |
| `Shelf` | Discord user ID | IMDb title ID | Personal movie-shelf membership |
| `Watched` | Discord user ID | IMDb title ID | Watched-with-the-kids status |
| `ExchangeCodes` | `exchange` | Exchange code identifier | Redeemed sign-in codes, enforcing single use |
| `Rankings` | Discord user ID | IMDb title ID | Legacy records retained for rollback; not read or written |

IMDb title IDs are the canonical movie identifiers, making duplicate creation an atomic Table Storage conflict rather than a title-comparison heuristic.

## Metadata

Search uses the TMDB movie API. MCU fetches movie details to retain the IMDb ID as the canonical key, maps TMDB's user score and vote count, production companies, and release year, selects the preferred US theatrical certification from regional release dates, and renders `w500` posters from TMDB's image CDN. Missing images use the MCU poster placeholder.

A function-key-protected refresh route resolves existing IMDb IDs through TMDB and atomically replaces only each movie entity's metadata, including current TMDB rating data. Shelf and watched records remain valid because their IMDb row keys do not change.

## Personal movie shelves

Each `Shelf` entity flags a shared-catalog movie for one user. The API returns the union of explicit shelf records and watched records, so every watched movie appears on My movie shelf, including watched data created before the Shelf table existed. Marking a movie watched persists both states. Marking it unwatched removes only the watched state, while removing a shelf flag is rejected until the movie is unwatched.

## Watched-count aggregation

Each `Watched` entity has a unique Discord-user partition key and IMDb row key, so a user contributes at most one watch to a movie. The community list counts unique users per IMDb ID and sorts by count descending. Movies with equal counts receive the same dense rank; the web client displays tied movies alphabetically. The personal list filters the catalog by the signed-in user's watched IDs and sorts titles alphabetically.

## Client data flow

The client loads the catalog, personal state, and community counts once per session start. Watched and shelf toggles update local state immediately, send a single write, and refresh only the community summary; a failed write rolls the local state back and reports the error. Catalog membership checks project row keys instead of reading full movie rows, and table clients and their managed-identity credential are reused for the life of a Function instance so access tokens stay cached.

## Cost controls

- Static Web Apps Free plan
- Functions Flex Consumption, 512 MB, no always-ready instances, maximum two instances
- Standard LRS storage
- Log Analytics pay-as-you-go with 30-day retention
- No database servers, containers, or private endpoints
- TMDB developer API for noncommercial use with required attribution
