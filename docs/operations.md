# Operations

## Health and telemetry

- API health: `GET /api/health`
- Application Insights captures requests, dependencies, exceptions, and traces.
- Log Analytics retains initial telemetry for 30 days.

Recommended queries:

```kusto
requests
| where timestamp > ago(24h)
| summarize count(), failures=countif(success == false) by name
| order by failures desc
```

```kusto
exceptions
| where timestamp > ago(7d)
| project timestamp, type, outerMessage, operation_Name
| order by timestamp desc
```

## Backups

Azure Table Storage does not provide application-level point-in-time restore in this design. Before destructive maintenance or metadata refresh, export the Movies, Users, Shelf, and Watched tables with Azure Storage Explorer or `az storage entity query` using an authorized identity. Movie metadata can be reconstructed from TMDB, but shelf and watched status cannot. The unused legacy Rankings table is retained for rollback.

## Recovery

1. Redeploy infrastructure with AZD.
2. Restore Key Vault secrets.
3. Import saved table entities.
4. Verify `/api/health`, Discord sign-in, movie search, TMDB rating display, shelf and watched toggles, My movie shelf, My Watched Movies, and Munch Watched Movies.

## Routine maintenance

- `ExchangeCodes` records one small row per completed sign-in so codes cannot be replayed. Rows older than a day are
  no longer meaningful and can be deleted at any time; the table is safe to empty while nobody is mid-sign-in.
- Role assignments removed from Bicep are not deleted by a redeploy. After the storage role was narrowed to Storage
  Blob Data Contributor, remove any leftover Storage Blob Data Owner assignment for the API identity on the storage
  account.

## Secret rotation

- Rotate the session secret to invalidate all sessions.
- Session renewal failures are non-destructive: the current valid session remains usable and renewal retries on the next application load.
- Rotate the Discord client secret in the Discord portal, then update Key Vault.
- Rotate the TMDB API read-access token in TMDB, then update Key Vault.
- Function App Key Vault references pick up new versions automatically; restart the app if immediate refresh is required.

## Cost monitoring

Review Cost Management monthly for Functions executions, Log Analytics ingestion, and storage transactions. Unexpected search traffic should be investigated through Application Insights dependency telemetry.
