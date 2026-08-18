# Security

## Authentication

- Discord OAuth uses authorization-code flow.
- A random state value in a Secure, HttpOnly, SameSite=Lax cookie prevents login CSRF.
- The callback validates membership in the configured Discord guild.
- The full session token is not placed in the redirect URL; a 60-second exchange code is used.
- Exchange codes are single-use. Each code carries a unique identifier that is recorded by an atomic Table Storage create, so a replayed code is rejected even inside its 60-second window.
- Callback failures redirect to the application with a readable message instead of returning a raw JSON body to the browser.
- Only an explicit Discord 403 or 404 denies guild membership. Discord outages and timeouts surface as a retryable error rather than a misleading access denial.
- Signed sessions expire after 30 days and can be renewed only while the existing bearer session is still valid.
- Business endpoints independently validate the signed bearer session.

## Secrets and identities

- Discord, session, and TMDB API secrets are stored in Key Vault.
- The Function App uses a user-assigned managed identity.
- Storage Table Data Contributor, Storage Blob Data Contributor, and Key Vault Secrets User are assigned at resource scope.
- The blob role covers only the Flex Consumption deployment container, which is the least privilege documented for that identity.
- Storage shared-key access is disabled.
- No secret belongs in source control, AZD environment output, or GitHub workflow logs.

## Application controls

- IMDb IDs and numeric TMDB movie IDs are format-validated, including IMDb IDs taken from route parameters before they are used as Table Storage row keys.
- Duplicate movie creation relies on an atomic Table Storage create.
- Shelf markers use a unique user/movie Table Storage key and can be read or changed only through an authenticated session.
- Watched movies cannot be removed from a user's shelf until they are marked unwatched.
- Watched markers use a unique user/movie Table Storage key, preventing duplicate contributions to community counts.
- Personal shelf and personal/community watched data require a valid application session.
- Metadata requests have bounded query lengths.
- Security headers include CSP, frame denial, content-type protection, and restrictive browser permissions.
- The CSP `connect-src` is generated at build time from `VITE_API_URL`, so it names the exact API origin for the deployment instead of a wildcard host.
- API responses are sent with `Cache-Control: no-store`, keeping session tokens and identity out of shared caches.
- Outbound Discord and TMDB calls use request timeouts so a slow upstream cannot hold a Function instance open.
- The allowed browser origin must be configured explicitly in production; a missing `FRONTEND_URL` fails closed rather than falling back to a development origin.
- Production dependencies for both the API and the web client are audited for high-severity vulnerabilities, and CodeQL analyses run in CI.
- The catalog refresh route requires an Azure Functions function key and is not available to ordinary Discord sessions.

## Known tradeoffs

- The rolling access token is stored in browser local storage. CSP and no third-party scripts reduce exposure, but an HttpOnly same-origin refresh session would provide stronger XSS resistance if the frontend and API are later consolidated behind one domain.
- The public Functions endpoint accepts authenticated cross-origin calls from the Static Web App. Every business operation must retain endpoint-level authorization.
- TMDB data is externally maintained and is treated as untrusted input before storage or rendering.

- Key Vault is RBAC-only but remains reachable from the public network, because the Flex Consumption app resolves Key Vault references over shared outbound addresses. Restricting it requires running the app behind the optional VNet with a private endpoint.
