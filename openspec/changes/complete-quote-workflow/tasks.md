# Tasks: Complete Quote Workflow

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 900–1,300 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 contract/versioning → PR 2 lifecycle synchronization |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Persist and expose compatible quote versions | PR 1 | `pnpm test --runInBand src/prisma/workshop-tenancy-schema.spec.ts src/modules/quotes/quotes.service.spec.ts src/modules/quotes/quotes.openapi.spec.ts` | `DATABASE_URL=<disposable> DIRECT_URL=<disposable> pnpm prisma migrate deploy` | Revert the new migration, Quote schema/DTO mapping, and version route before lifecycle lands |
| 2 | Enforce lifecycle and synchronize orders atomically | PR 2 | `pnpm test --runInBand src/modules/quotes/quotes.service.spec.ts src/modules/service-orders/service-orders.service.spec.ts` | `pnpm test:e2e --runInBand test/quotes.e2e-spec.ts` | Revert quote transition/locking logic and order-cancellation integration; PR 1 contract remains |

## Phase 1: Contract and Versioning — PR 1

- [x] 1.1 **RED:** Extend `src/prisma/workshop-tenancy-schema.spec.ts` with compatible/conflicting legacy fixtures, deterministic lineage, partial indexes, and diagnostic abort assertions.
- [x] 1.2 **GREEN:** Update `prisma/schema.prisma` and add the SQL migration for `SUPERSEDED`, `QuoteApprovalMethod`, version lineage, `EUR`, decision detail, checks, tenant-safe FK, and unique/partial indexes.
- [ ] 1.3 **RED:** Add quote service/OpenAPI tests for version-1 creation, draft-only editing, currency normalization, newest-first responses, tenant isolation, eligible cloning, one draft, and concurrent `409`.
- [ ] 1.4 **GREEN:** Extend quote DTOs, response types, controllers, and `QuotesService` with validated currency, version cloning, aggregate locking, conflict translation, and order-stage eligibility.
- [ ] 1.5 **REFACTOR:** Extract shared quote mapping/validation helpers; document fields, enums, route, RBAC, and `400/403/404/409` without changing behavior.

## Phase 2: Lifecycle Synchronization — PR 2

- [ ] 2.1 **RED:** Add tests for the transition matrix, response-only `SUPERSEDED`, decision method/detail rules, immutable approval, active replacement, concurrent activation, history, state drift, and order cancellation.
- [ ] 2.2 **GREEN:** Implement serialized quote transitions, controlled decisions, atomic `DIAGNOSIS→QUOTED→APPROVED` history, supersession, and `ServiceOrdersService.changeStatus` cancellation of open quotes.
- [ ] 2.3 **REFACTOR:** Consolidate transaction locking, transition policy, audit logging, and shared role constants while preserving tenancy and error semantics.

## Phase 3: Integration and Verification

- [ ] 3.1 **RED/GREEN:** Add `test/quotes.e2e-spec.ts` for RBAC, foreign-resource `404`, and diagnosis → v1 → activate → v2 → supersede → approve.
- [ ] 3.2 Validate migration success and preflight failure against disposable PostgreSQL databases; record exact commands/results in work-unit evidence.
- [ ] 3.3 Run `pnpm test --runInBand`, `pnpm test:e2e`, `pnpm build`, `pnpm exec prisma validate`, `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"`, and `git diff --check`; update OpenAPI/OpenSpec docs and report final counts for `BACKLOG.md`.
