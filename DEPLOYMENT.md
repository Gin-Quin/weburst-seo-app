# Production deployment

The production application uses the Turso database configured in `.env.prod`.
Database migrations must be applied from the repository before the application is restarted because the production server only receives the compiled `build/` directory.

## Prerequisites

- The production `.env.prod` file contains the correct `DATABASE_URL` and
  `DATABASE_AUTH_TOKEN`.
- Bun dependencies are installed with `bun install --frozen-lockfile`.
- The working tree and branch contain the migration files intended for the release.
- A recent Turso backup or recovery point is available before applying schema changes.

## Complete deployment

From the repository root:

```bash
# 1. Install exactly the locked dependencies.
bun install --frozen-lockfile

# 2. Run the test suite and type checks.
bun test
bun run check

# 3. Apply committed Drizzle migrations to the production Turso database.
bun --env-file=.env.prod run db:migrate

# 4. Apply committed ClickHouse migrations when the release contains any.
bun --env-file=.env.prod run clickhouse:migrate

# 5. Build, upload, and restart the production application.
bun run deploy
```

Do not run `bun migrate` against production. That command generates migrations and uses `db:push`; production deployments must apply reviewed, committed files with `db:migrate`.

If step 3 or 4 fails, stop the deployment and do not restart the application.
If the application upload or restart fails after a successful database
migration, fix or roll back the application release; do not delete migration records or manually reverse schema changes without a reviewed rollback plan.

## Verification

After deployment:

1. Confirm `systemctl status my-bun-app` reports a running service.
2. Open the production login page and authenticate.
3. Confirm an admin can list clients and projects.
4. Confirm a project manager only sees projects belonging to assigned clients.
5. Confirm a client user only sees projects belonging to their own client and cannot modify project settings or keyword analyses.

## Current deployment implementation

`scripts/deploy.ts` builds locally, uploads `build/` and `.env.prod`, and
restarts `my-bun-app`. It does not apply database migrations, so step 3 remains mandatory until migration execution is added to the deployment script or CI.
