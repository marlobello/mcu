# Security

## Authentication

- Discord OAuth uses authorization-code flow.
- A random state value in a Secure, HttpOnly, SameSite=Lax cookie prevents login CSRF.
- The callback validates membership in the configured Discord guild.
- The full session token is not placed in the redirect URL; a 60-second exchange code is used.
- Signed sessions expire after 30 days and can be renewed only while the existing bearer session is still valid.
- Business endpoints independently validate the signed bearer session.

## Secrets and identities

- Discord, session, and TMDB API secrets are stored in Key Vault.
- The Function App uses a user-assigned managed identity.
- Storage Table Data Contributor and Key Vault Secrets User are assigned at resource scope.
- Storage shared-key access is disabled.
- No secret belongs in source control, AZD environment output, or GitHub workflow logs.

## Application controls

- IMDb IDs and numeric TMDB movie IDs are format-validated.
- Duplicate movie creation relies on an atomic Table Storage create.
- Shelf markers use a unique user/movie Table Storage key and can be read or changed only through an authenticated session.
- Watched movies cannot be removed from a user's shelf until they are marked unwatched.
- Watched markers use a unique user/movie Table Storage key, preventing duplicate contributions to community counts.
- Personal shelf and personal/community watched data require a valid application session.
- Metadata requests have bounded query lengths.
- Security headers include CSP, frame denial, content-type protection, and restrictive browser permissions.
- Production dependencies are audited for high-severity vulnerabilities.
- The catalog refresh route requires an Azure Functions function key and is not available to ordinary Discord sessions.

## Known tradeoffs

- The rolling access token is stored in browser local storage. CSP and no third-party scripts reduce exposure, but an HttpOnly same-origin refresh session would provide stronger XSS resistance if the frontend and API are later consolidated behind one domain.
- The public Functions endpoint accepts authenticated cross-origin calls from the Static Web App. Every business operation must retain endpoint-level authorization.
- TMDB data is externally maintained and is treated as untrusted input before storage or rendering.
