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

Azure Table Storage does not provide application-level point-in-time restore in this design. Before destructive maintenance, export all four tables with Azure Storage Explorer or `az storage entity query` using an authorized identity. Movie metadata can be reconstructed from Wikidata, but rankings and watched status cannot.

## Recovery

1. Redeploy infrastructure with AZD.
2. Restore Key Vault secrets.
3. Import saved table entities.
4. Verify `/api/health`, Discord sign-in, movie search, ranking save, and watched toggles.

## Secret rotation

- Rotate the session secret to invalidate all sessions.
- Rotate the Discord client secret in the Discord portal, then update Key Vault.
- Function App Key Vault references pick up new versions automatically; restart the app if immediate refresh is required.

## Cost monitoring

Review Cost Management monthly for Functions executions, Log Analytics ingestion, and storage transactions. Unexpected search traffic should be investigated through Application Insights dependency telemetry.
