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

## GitHub Actions

`ci.yml` validates every pull request. `deploy.yml` supports OIDC-based deployment after repository environment variables and Azure federation are configured.
