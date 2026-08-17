# Deployment

## Azure context

- Subscription: Visual Studio Enterprise Subscription
- Subscription ID: `a10fe8c6-bd05-4787-8c57-500adc890661`
- Region: Central US
- Environment: `mcu-prod`

## Required configuration

```bash
azd env set AZURE_SUBSCRIPTION_ID a10fe8c6-bd05-4787-8c57-500adc890661
azd env set AZURE_LOCATION centralus
azd env set VNET_ENABLED false
azd env set DISCORD_CLIENT_ID 1538929522278404156
azd env set DISCORD_GUILD_ID 734095597342294107
azd env set CUSTOM_DOMAIN mcu.dotheneedful.dev
azd env set CONFIGURE_CUSTOM_DOMAIN false
```

The Key Vault must contain:

- `discord-client-secret`
- `session-secret`
- `tmdb-api-token`

Create a TMDB developer API read-access token and store it directly in Key Vault. Do not place it in AZD environment output, source control, or chat.

## Provision and deploy

Use the repository's validation and deployment workflow:

1. Set `.azure/plan.md` to `Ready for Validation`.
2. Run the `azure-validate` skill and record evidence.
3. Run the `azure-deploy` skill.
4. Prefer two phases so managed-identity RBAC can propagate:

```bash
azd provision --no-prompt
azd deploy --no-prompt
```

## Discord callback

After provisioning, add this URL to the dedicated Munch Classics Universe Discord application's OAuth redirect list:

```text
https://<function-app-name>.azurewebsites.net/api/auth/callback
```

## Custom domain

The deployment outputs `STATIC_WEB_APP_HOSTNAME`.

1. Create a DNS CNAME from `mcu.dotheneedful.dev` to that hostname.
2. Set `CONFIGURE_CUSTOM_DOMAIN=true`.
3. Run `azd provision --no-prompt` again.

Azure Static Web Apps provisions and renews the TLS certificate.

## Refresh existing movie metadata

After deploying the TMDB-enabled API, invoke the function-key-protected route once:

```bash
FUNCTION_KEY=$(az functionapp keys list \
  --resource-group rg-mcu-prod \
  --name func-api-rzsvqm3nukyik \
  --query functionKeys.default \
  --output tsv)
curl --fail-with-body --request POST \
  "https://func-api-rzsvqm3nukyik.azurewebsites.net/api/movies/refresh?code=${FUNCTION_KEY}"
```

The response lists refreshed, unmatched, and failed IMDb IDs. Export the tables before running the refresh and investigate any non-empty `unmatched` or `failed` collection.

## GitHub Actions

`ci.yml` validates every pull request. `deploy.yml` supports OIDC-based deployment after repository environment variables and Azure federation are configured.
