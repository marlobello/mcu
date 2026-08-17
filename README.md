# Munch Classics Universe

Munch Classics Universe (MCU) is a private, mobile-friendly family movie tracker. Discord-authenticated users build a shared classic-movie catalog, mark movies watched with their children, review their personal watched list, and see which movies the community has watched most.

## Features

- Discord OAuth authentication restricted to a configured guild
- Shared movie catalog with duplicate prevention by IMDb title ID
- TMDB metadata and poster lookup while retaining IMDb IDs as canonical keys
- Release year, US content rating, production companies, IMDb link, and movie posters
- Personal watched-with-the-kids status
- Alphabetical “My Watched Movies” list
- “Munch Watched Movies” ranked by unique watcher count with shared ranks for ties
- Responsive, accessible React interface

## Architecture

| Layer | Technology |
|-------|------------|
| Web | React 19, TypeScript, Vite, Azure Static Web Apps |
| API | Azure Functions v4, Node.js 22, TypeScript |
| Data | Azure Table Storage |
| Identity | Discord OAuth 2.0 and signed application sessions |
| Secrets | Azure Key Vault |
| Telemetry | Application Insights and Log Analytics |
| Infrastructure | Azure Developer CLI and Bicep |

See [Architecture](docs/architecture.md) for the data model and watched-count aggregation.

## Local development

### Prerequisites

- Node.js 22
- Azure Functions Core Tools 4
- Azurite or an Azure Storage account
- A Discord OAuth application with `http://localhost:7071/api/auth/callback` registered
- A TMDB developer API read-access token

### Configure

```bash
cp .env.example .env
cp .env.example local.settings.env
```

Create `local.settings.json` for Azure Functions using the values documented in `.env.example`. Never commit secrets.

### Run

```bash
npm install
npm run build
npm start
```

In a second terminal:

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Quality checks

```bash
npm run build
npm test
npm audit --omit=dev --audit-level=high
cd web
npm run build
npm run lint
```

## Azure deployment

Deployment is managed by AZD:

```bash
azd env set AZURE_SUBSCRIPTION_ID a10fe8c6-bd05-4787-8c57-500adc890661
azd env set AZURE_LOCATION centralus
azd env set VNET_ENABLED false
azd up
```

Do not deploy manually before following [Deployment](docs/deployment.md). The repository's `.azure/plan.md` is the deployment source of truth.

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Operations](docs/operations.md)
- [Security](docs/security.md)
- [Contributing](CONTRIBUTING.md)
- [API component](src/README.md)
- [Web component](web/README.md)
- [Infrastructure](infra/README.md)

## License

This project is licensed under the MIT License. This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB data and images are used under the applicable [TMDB terms](https://www.themoviedb.org/documentation/api/terms-of-use).
