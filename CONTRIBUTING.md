# Contributing

## Workflow

1. Create a focused branch from `main`.
2. Keep secrets out of commits and use `.env.example` for configuration names.
3. Add or update tests for behavior changes.
4. Run all checks before opening a pull request.

```bash
npm install
npm run build
npm test
npm audit --omit=dev --audit-level=high
cd web
npm install
npm run build
npm run lint
```

Infrastructure changes must also pass:

```bash
az bicep build --file infra/main.bicep
```

## Conventions

- Use TypeScript strict mode.
- Keep Azure Functions handlers thin; shared behavior belongs in `src/shared`.
- Surface operational errors explicitly while returning safe client messages.
- Preserve IMDb IDs as canonical movie keys.
- Do not change the aggregate-ranking formula without updating tests and `docs/architecture.md`.
