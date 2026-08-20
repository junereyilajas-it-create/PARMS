# React + TypeScript + Vite

## Database-backed CRUD

Import [backend/database.sql](backend/database.sql) into MySQL, copy `backend/.env.example` to `backend/.env`, and start both applications with `npm run dev:all`.

The import creates linked sample data for every table (at least three records per table) and a development account: `admin` / `password`. The frontend automatically uses that local development account; override it with `VITE_DEMO_USERNAME` and `VITE_DEMO_PASSWORD` if needed.

All tables have authenticated REST CRUD endpoints under `/api`. For example: `/api/owners`, `/api/properties`, `/api/lots`, `/api/buildings`, `/api/assessments`, `/api/inspections`, and `/api/backups`. The Property Lot Management and Building Directory pages read and write those endpoints directly.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
