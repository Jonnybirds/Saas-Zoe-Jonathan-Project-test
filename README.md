# AegisRisk Platform Monorepo

## Structure
- `apps/api`: NestJS core backend (auth, multi-tenant, RBAC skeleton).
- `packages/database`: Prisma schema + seed script.
- `docs/`: product and architecture strategy docs.

## Quick start
1. Install dependencies with `pnpm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and set secrets.
3. Run Prisma generate/migrate from repo root:
   - `pnpm db:generate`
   - `pnpm db:migrate`
   - `pnpm db:seed`
4. Start API:
   - `pnpm dev:api`

## Initial endpoints
- `POST /v1/auth/login`
- `GET /v1/users/me`
- `GET /v1/tenants/:tenantId`
- `GET /v1/iam/roles`
- `POST /v1/ai/decisions`
- `GET /v1/ai/decisions/:aiRunId`
