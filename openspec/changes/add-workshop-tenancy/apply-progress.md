# Apply Progress: add-workshop-tenancy

**Change**: add-workshop-tenancy  
**Mode**: Strict TDD

## Completed Tasks

- [x] 1.1 Add RED Prisma/integration coverage for owner trigger, named constraints, cross-workshop FK rejection, and reset refusal without approval evidence (`prisma/**`, new migration tests).
- [x] 1.2 Update `prisma/schema.prisma`, new migration, `prisma/seed.ts`, and reset runbook for `Workshop`, `Membership`, `Invitation`, `AuthSelection`, `workshopId` propagation, `OWNER`, and required unique/FK names.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/prisma/seed.spec.ts` | Modified | Added RED coverage proving workshop tenancy seeds the `OWNER` role explicitly. |
| `src/prisma/workshop-tenancy-schema.spec.ts` | Created | Added schema assertions for tenancy models, scoped uniqueness, composite relations, and auth-session membership groundwork. |
| `src/prisma/workshop-tenancy-migration.spec.ts` | Created | Added migration and runbook assertions for named constraints, cross-workshop relation rejection, controlled-reset guards, and required `NOT NULL` workshop columns. |
| `prisma/schema.prisma` | Modified | Added tenancy foundation models, workshop-scoped foreign keys and uniqueness, and an optional `AuthSession.membershipId` compatibility bridge. |
| `prisma/seed.ts` | Modified | Seeded the `OWNER` role into the bootstrap role catalog. |
| `prisma/migrations/20260716030000_add_workshop_tenancy_foundation/migration.sql` | Created | Added the approved tenancy foundation migration with reset guardrails, named constraints, composite foreign keys, scoped indexes, and deferred owner trigger SQL. |
| `prisma/workshop-tenancy-reset-runbook.md` | Created | Documented backup evidence, explicit approval, reset order, and rollback requirements for the controlled reset. |
| `openspec/changes/add-workshop-tenancy/tasks.md` | Created | Recorded the stacked-to-main reconstruction slice and marked only Phase 1 complete. |
| `openspec/changes/add-workshop-tenancy/apply-progress.md` | Created | Recorded Strict TDD evidence for the reconstructed Prisma foundation slice only. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `src/prisma/seed.spec.ts`, `src/prisma/workshop-tenancy-schema.spec.ts`, `src/prisma/workshop-tenancy-migration.spec.ts` | Unit / Prisma static integration | ⚠️ `pnpm test -- --runTestsByPath src/prisma/seed.spec.ts` initially failed because the clean worktree reused an already-generated Prisma client from the source snapshot; after adding explicit RED expectations, the same focused path still failed for the missing schema foundation as intended. | ✅ Wrote failing assertions first; `pnpm test -- --runTestsByPath src/prisma/seed.spec.ts src/prisma/workshop-tenancy-schema.spec.ts src/prisma/workshop-tenancy-migration.spec.ts` failed because `OWNER`, tenancy models, migration SQL, and runbook artifacts were missing from the clean branch. | ✅ Same focused command after implementation → 3 suites, 12 tests passed. | ✅ Covered owner seed presence, tenancy model declarations, named constraints, deferred owner trigger, same-workshop foreign keys, reset gates, and required `NOT NULL` workshop columns across multiple test cases. | ➖ None needed — the reconstructed foundation code matched the approved slice once the tests were green. |
| 1.2 | `src/prisma/seed.spec.ts`, `src/prisma/workshop-tenancy-schema.spec.ts`, `src/prisma/workshop-tenancy-migration.spec.ts` | Prisma schema + migration foundation | ⚠️ Same environment note as task 1.1 for the initial clean-branch safety net. | ✅ Reused the RED from task 1.1 before copying the approved Prisma artifacts into the clean worktree. | ✅ `pnpm test -- --runTestsByPath src/prisma/seed.spec.ts src/prisma/workshop-tenancy-schema.spec.ts src/prisma/workshop-tenancy-migration.spec.ts` → 3 suites, 12 tests passed; `pnpm build` → exit 0. | ✅ Exercised distinct schema, migration, and runbook behaviors rather than a single golden assertion. | ✅ Kept the schema foundation compatible with the current pre-tenancy runtime by retaining legacy `User.roleId` and a nullable `AuthSession.membershipId`; later slices remove that bridge. |

## Test Summary

- **Total tests written**: 12
- **Total tests passing**: 12
- **Layers used**: Unit / Prisma static integration (12)
- **Approval tests**: None — new foundation slice
- **Pure functions created**: 0

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/prisma/seed.spec.ts src/prisma/workshop-tenancy-schema.spec.ts src/prisma/workshop-tenancy-migration.spec.ts` → exit 0, 3 suites passed, 12 tests passed. |
| Runtime harness command/scenario and exact result | `N/A` — this slice is the Prisma schema/reset/seed foundation only, and no HTTP runtime boundary exists before later auth and module work lands. |
| Rollback boundary | Revert only `src/prisma/seed.spec.ts`, `src/prisma/workshop-tenancy-schema.spec.ts`, `src/prisma/workshop-tenancy-migration.spec.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/20260716030000_add_workshop_tenancy_foundation/migration.sql`, `prisma/workshop-tenancy-reset-runbook.md`, and the Phase 1 OpenSpec progress files under `openspec/changes/add-workshop-tenancy/`. |

## Deviations from Design

- To keep the current pre-tenancy NestJS code compiling until later slices land, this foundation retains legacy `User.roleId`/`Role.users` wiring and leaves `AuthSession.membershipId` nullable even though the final design expects membership-bound authorization and sessions.

## Issues Found

- The clean reconstruction needed an isolated worktree because the source worktree already contains later Phase 2+ tenancy changes.
- Reusing the source snapshot's generated Prisma client inside the clean worktree made the first seed-spec safety net look dirty; the actual RED still came from the missing foundation files on the clean branch.

## Remaining Tasks

- [ ] 2.1 Add RED tests in `src/modules/auth/*.spec.ts`, `src/common/guards/*.spec.ts`, and decorator specs for JWT claims `{sub,mid,wid,typ}`, restricted-selection denial, active-membership acceptance, and stale membership/session mismatch rejection.
- [ ] 2.2 Replace `src/common/auth/authenticated-user.ts` with membership-scoped context, update decorators/guards, and rework `src/modules/auth/jwt.strategy.ts` + module wiring to load `ActiveWorkshopContext` only from current user+membership state.
- [ ] 3.1 Add RED tests for single-membership login, multi-membership restricted selection, `POST /auth/select-workshop` one-time exchange, membership-bound session persistence, and generic invalid-login/select failures in `src/modules/auth/*.spec.ts` and `test/auth.e2e-spec.ts`.
- [ ] 3.2 Implement `src/modules/auth/**` login/select-workshop/session issuance so single-membership login mints `{sub,mid,wid,typ=access}`, multi-membership login returns only a restricted selection token + choices, and sessions bind `membershipId`.
- [ ] 3.3 Add RED tests for `POST /auth/register-workshop` atomic owner/workshop/membership/session creation plus `409` rollback and normalized email handling.
- [ ] 3.4 Implement `register-workshop` DTO/controller/service flow in `src/modules/auth/**` using the shared membership-bound issuer/session helpers.
- [ ] 3.5 Add RED tests for authenticated `POST /auth/switch-workshop`, same-family refresh rotation, refresh-family reuse revocation, concurrent-session independence, and logout/logout-all scope.
- [ ] 3.6 Implement switch, refresh, logout, and logout-all session-family behavior in `src/modules/auth/**`, preserving pre-switch access-token workshop isolation until expiry.
- [ ] 4.1 Add RED tests for owner-issued invitation create/revoke/accept-once, expiry/reuse/revocation rejection, non-`OWNER` employee-only creation, duplicate-membership block, and users same-workshop-only authorization.
- [ ] 4.2 Create `src/modules/{workshops,memberships,invitations}/**`, wire `src/app.module.ts`, scope `src/modules/users/**` to active `OWNER` memberships with cross-workshop masking, and update Swagger/OpenAPI docs for public vs Bearer tenancy routes.
- [ ] 5.1 Add workshop-scoped checks anywhere current code touches workshop-owned Prisma models; require same-transaction relation resolution and `workshops/{workshopId}/...` storage prefixes.
- [ ] 5.2 Update `test/auth.e2e-spec.ts`, `test/users.e2e-spec.ts`, and `src/modules/*/*.openapi.spec.ts` for documented `401/403/404/409`, direct cross-workshop denial, invitation lifecycle, and auth-vs-tenancy route ownership.
- [ ] 5.3 Final merge gate: run focused Jest slices, `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts`, and `pnpm build` only after backup proof, controlled-reset approval, clean child diffs, and rollback notes per unit.

## Workload / PR Boundary

- **Mode**: stacked PR slice
- **Current work unit**: Work Unit 1 / PR1 — schema/reset/seed foundation
- **Boundary**: Starts from `main` in an isolated clean worktree and ends after the Prisma schema, migration, seed, runbook, and focused Prisma test foundation only. No auth-context, auth-flow, invitation, or business-module work was reconstructed here.
- **Estimated review budget impact**: Approximately 756 authored lines for the approved foundation slice, within the session's 800-line review budget.

## Status

- 2/15 task lines complete.
- Ready for the next stacked slice: Phase 2 auth context foundation.

## Phase 1 Foundation Correction — Owner Trigger and Atomic Migration

This corrective work unit stays within PR1 foundation scope. It does not advance Phase 2–5 task checkboxes.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Phase 1 correction: owner invariant and migration atomicity | `src/prisma/workshop-tenancy-migration.spec.ts`, `src/prisma/workshop-tenancy-postgres.integration.spec.ts` | Prisma static + opt-in PostgreSQL integration | ✅ Existing Phase 1 focused tests were included in the final focused run. | ✅ `pnpm test -- --runTestsByPath src/prisma/workshop-tenancy-migration.spec.ts src/prisma/workshop-tenancy-postgres.integration.spec.ts` initially failed: explicit `BEGIN`/`COMMIT`, OLD+NEW validation markers, exact-owner count, and maintenance runbook requirements were absent. The initial opt-in test constructor also required a no-URL guard, which was fixed in the harness before GREEN. | ✅ Static GREEN: final focused command passed 14 tests. ✅ Runtime GREEN: a temporary local PostgreSQL 15 database executed all 3 integration scenarios successfully. | ✅ The opt-in PostgreSQL suite covers deferred-commit extra OWNER rejection, an OLD→NEW owner-membership move rejection, and reset-guard rollback atomicity. | ✅ Reworked the trigger to iterate every affected workshop, lock each parent workshop for commit-time serialization, and count both all active OWNER memberships and owner-matching active OWNER memberships. |

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/prisma/seed.spec.ts src/prisma/workshop-tenancy-schema.spec.ts src/prisma/workshop-tenancy-migration.spec.ts src/prisma/workshop-tenancy-postgres.integration.spec.ts` → exit 0; 3 suites passed, 1 suite skipped; 14 passed, 3 skipped, 17 total. |
| PostgreSQL runtime harness command/scenario and exact result | Runtime command: `TEST_DATABASE_URL='postgresql://aletrejo@localhost:5432/racerlab_tenancy_test_<timestamp>' pnpm test -- --runTestsByPath src/prisma/workshop-tenancy-postgres.integration.spec.ts` → exit 0; 1 suite passed, 3 tests passed. The temporary PostgreSQL 15 database was created with `createdb`, then dropped in a shell `trap` with `dropdb --if-exists`; post-run `select exists(select 1 from pg_database where datname like 'racerlab_tenancy_test_%');` returned `f`. The suite resets only a database whose name contains `test`, applies the two prerequisite migrations plus this migration through `pnpm prisma db execute`, and proves reset-guard rollback atomicity, deferred-commit extra OWNER rejection, and OLD→NEW move rejection. |
| Prisma validation | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/racerlab_test' DIRECT_URL='postgresql://postgres:postgres@127.0.0.1:5432/racerlab_test' pnpm exec prisma validate` → exit 0, schema valid. |
| Build and lint | `pnpm exec eslint src/prisma/workshop-tenancy-migration.spec.ts src/prisma/workshop-tenancy-postgres.integration.spec.ts` → exit 0; `pnpm build` → exit 0. `pnpm lint` was not run because its package script includes `--fix`. |
| Rollback boundary | Revert only `prisma/migrations/20260716030000_add_workshop_tenancy_foundation/migration.sql`, `prisma/workshop-tenancy-reset-runbook.md`, `src/prisma/workshop-tenancy-migration.spec.ts`, `src/prisma/workshop-tenancy-postgres.integration.spec.ts`, and this correction section in `openspec/changes/add-workshop-tenancy/apply-progress.md`. This restores the prior PR1 foundation behavior without touching Phase 2+ work. |

### Correction Status

- Static and build checks are green.
- PostgreSQL runtime proof is green on a temporary local PostgreSQL 15 database; the temporary database was dropped after the suite.
- Delivery strategy: `auto-chain`; chain strategy: `stacked-to-main`; PR boundary remains PR1 foundation correction only.
