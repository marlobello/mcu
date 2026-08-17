# Architecture

MCU uses a low-idle-cost Azure architecture: a static React client, a scale-to-zero Functions API, and Azure Table Storage.

## Request flow

1. The browser loads the React application from Azure Static Web Apps.
2. Sign-in redirects to Discord through the Functions API.
3. The callback validates OAuth state and Discord guild membership.
4. The API issues a short-lived exchange code; the browser exchanges it for a seven-day signed session token.
5. Authenticated API requests use the bearer token.
6. The Function App uses its user-assigned managed identity for Table Storage and Key Vault.

## Data model

| Table | Partition key | Row key | Purpose |
|-------|---------------|---------|---------|
| `Movies` | `movie` | IMDb title ID | Shared movie metadata |
| `Users` | `user` | Discord user ID | Display name and avatar |
| `Rankings` | Discord user ID | IMDb title ID | Ordered position for a user's ranked movies |
| `Watched` | Discord user ID | IMDb title ID | Watched-with-the-kids status |

IMDb title IDs are the canonical movie identifiers, making duplicate creation an atomic Table Storage conflict rather than a title-comparison heuristic.

## Metadata

Search uses the TMDB movie API. MCU fetches movie details to retain the IMDb ID as the canonical key, maps production companies and release year, selects the preferred US theatrical certification from regional release dates, and renders `w500` posters from TMDB's image CDN. Missing images use the MCU poster placeholder.

A function-key-protected refresh route resolves existing IMDb IDs through TMDB and atomically replaces only each movie entity's metadata. Rankings and watched records remain valid because their IMDb row keys do not change.

## Ranking algorithm

Only movies explicitly included in a user's ordered list are ranked. For a list of length `n`, position `p` receives:

```text
score = 1                              when n = 1
score = 1 - ((p - 1) / (n - 1))       when n > 1
```

The aggregate score is the mean of the normalized scores from users who ranked that movie. Unranked movies do not contribute a zero. Results sort by score, then participation count, then IMDb ID for deterministic ties.

## Cost controls

- Static Web Apps Free plan
- Functions Flex Consumption, 512 MB, no always-ready instances, maximum two instances
- Standard LRS storage
- Log Analytics pay-as-you-go with 30-day retention
- No database servers, containers, or private endpoints
- TMDB developer API for noncommercial use with required attribution
