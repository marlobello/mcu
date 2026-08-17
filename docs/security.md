# Security

## Authentication

- Discord OAuth uses authorization-code flow.
- A random state value in a Secure, HttpOnly, SameSite=Lax cookie prevents login CSRF.
- The callback validates membership in the configured Discord guild.
- The full session token is not placed in the redirect URL; a 60-second exchange code is used.
- Business endpoints independently validate the signed bearer session.

## Secrets and identities

- Discord and session secrets are stored in Key Vault.
- The Function App uses a user-assigned managed identity.
- Storage Table Data Contributor and Key Vault Secrets User are assigned at resource scope.
- Storage shared-key access is disabled.
- No secret belongs in source control, AZD environment output, or GitHub workflow logs.

## Application controls

- IMDb IDs and Wikidata IDs are format-validated.
- Duplicate movie creation relies on an atomic Table Storage create.
- Ranking payloads reject duplicates and unknown movies.
- Metadata requests have bounded query lengths.
- Security headers include CSP, frame denial, content-type protection, and restrictive browser permissions.
- Production dependencies are audited for high-severity vulnerabilities.

## Known tradeoffs

- The access token is stored in browser local storage. CSP and no third-party scripts reduce exposure, but an HttpOnly same-origin session would provide stronger XSS resistance if the frontend and API are later consolidated behind one domain.
- The public Functions endpoint accepts authenticated cross-origin calls from the Static Web App. Every business operation must retain endpoint-level authorization.
- Wikidata data is community-maintained and should be treated as untrusted input.
