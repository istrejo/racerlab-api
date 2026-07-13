# Apply Progress: Complete Auth Session Cycle

**Change**: complete-auth-session-cycle  
**Mode**: Strict TDD

## Completed Tasks

- [x] 1.1 RED: expand `src/config/auth.config.spec.ts` for refresh TTL and cookie env parsing before changing auth config.
- [x] 1.2 GREEN: add refresh config fields in `src/config/auth.config.ts`, document them in `.env.example`, and register cookie parser in `src/main.ts` plus `package.json`.
- [x] 1.3 RED: create `src/modules/auth/auth-session.service.spec.ts` for hash-only storage, family linkage, expiry lookup, and metadata capture.
- [x] 1.4 GREEN: add `User.authSessions` + `AuthSession` to `prisma/schema.prisma`, add the migration with unique hash and active-session indexes, and land the minimal session helper required to satisfy the RED spec.
- [x] 2.1 RED: add failing service tests for login cookie issuance, generic invalid refresh rejection, rotation, and replay-family revocation in `src/modules/auth/auth.service.spec.ts`.
- [x] 2.2 GREEN: implement refresh token generation/hash/session persistence in `src/modules/auth/auth-session.service.ts` and transactional rotate-or-revoke logic in `src/modules/auth/auth.service.ts`.
- [x] 2.3 RED: add e2e coverage in `test/auth.e2e-spec.ts` for `POST /auth/login` cookie issuance, `POST /auth/refresh`, generic `401`, and concurrent-session independence.
- [x] 2.4 GREEN: update `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.module.ts`, `src/modules/auth/dto/login-response.dto.ts`, and create `src/modules/auth/dto/refresh-response.dto.ts`.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/config/auth.config.spec.ts` | Modified | Added RED coverage for refresh TTL parsing, cookie secure/sameSite validation, and optional domain handling. |
| `src/main.spec.ts` | Modified | Added RED coverage proving cookie-parser registration during app bootstrap. |
| `src/config/auth.config.ts` | Modified | Added refresh token TTL and refresh cookie config parsing/validation helpers. |
| `src/main.ts` | Modified | Registered cookie-parser before validation/Swagger setup. |
| `.env.example` | Modified | Documented JWT and refresh-cookie environment variables for the session flow. |
| `package.json` | Modified | Added `cookie-parser` runtime dependency and `@types/cookie-parser` dev typings. |
| `pnpm-lock.yaml` | Modified | Recorded the authorized cookie-parser dependency changes. |
| `src/modules/auth/auth-session.service.spec.ts` | Created | Added RED coverage for hash-only session storage, family linkage, expiry lookup, and metadata capture. |
| `src/modules/auth/auth-session.service.ts` | Created/Modified | Added session hashing/query foundation, raw refresh token issuance, and TTL-based refresh-session creation. |
| `prisma/schema.prisma` | Modified | Added `User.authSessions` and the `AuthSession` model. |
| `prisma/migrations/20260713105353_add_auth_sessions/migration.sql` | Created | Added the auth session table, unique token hash, base indexes, and active partial indexes. |
| `prisma/migrations/migration_lock.toml` | Created | Recorded Prisma's migration provider lock for the new migration directory. |
| `src/modules/auth/auth.service.spec.ts` | Modified | Added RED coverage for login cookie issuance, refresh rejection, rotation, and replay-family revocation. |
| `src/modules/auth/auth.service.ts` | Modified | Implemented refresh-session issuance on login, generic refresh validation, transactional rotation, and replay-family revocation. |
| `src/modules/auth/auth.controller.ts` | Modified | Issued the refresh cookie on login, added `POST /auth/refresh`, and mapped request metadata into auth-session flows. |
| `src/modules/auth/auth.module.ts` | Modified | Registered `AuthSessionService` in the Nest auth module. |
| `src/modules/auth/dto/login-response.dto.ts` | Modified | Kept the access-token-only body contract while login now issues the refresh token only as a cookie. |
| `src/modules/auth/dto/refresh-response.dto.ts` | Created | Added the access-token-only DTO for `POST /auth/refresh`. |
| `test/auth.e2e-spec.ts` | Modified | Added strict e2e coverage for login cookie issuance, refresh rotation, replay-family revocation, generic `401`, and concurrent-session independence with an in-memory auth-session harness. |
| `openspec/changes/complete-auth-session-cycle/tasks.md` | Modified | Marked Work Unit 1 and Work Unit 2 tasks complete. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `src/config/auth.config.spec.ts`, `src/main.spec.ts` | Unit | ✅ `pnpm test -- --runTestsByPath src/config/auth.config.spec.ts src/main.spec.ts` → 2 suites, 8 tests passed | ✅ Wrote failing refresh/cookie + bootstrap assertions first | ✅ Paired GREEN confirmed in task 1.2 via 2 suites, 15 tests passed | ✅ Added multiple TTL, cookie-flag, sameSite, blank-domain cases plus bootstrap middleware assertion | ✅ Extracted focused parsing helpers and kept tests green |
| 1.2 | `src/config/auth.config.spec.ts`, `src/main.spec.ts` | Unit | ✅ `pnpm test -- --runTestsByPath src/config/auth.config.spec.ts src/main.spec.ts` → 2 suites, 8 tests passed | ✅ Used the RED from task 1.1 before production edits | ✅ `pnpm test -- --runTestsByPath src/config/auth.config.spec.ts src/main.spec.ts` → 2 suites, 15 tests passed | ✅ Covered duration-string, integer, invalid, and middleware-registration paths | ✅ Config parsing split into small helpers; no further refactor needed |
| 1.3 | `src/modules/auth/auth-session.service.spec.ts` | Unit | N/A (new service/spec) | ✅ Wrote failing spec first; run failed with `Cannot find module './auth-session.service'` | ✅ Paired GREEN confirmed in task 1.4 via 1 suite, 4 tests passed | ✅ Added hash-only storage, existing-family reuse, active lookup, and unrelated-login family cases | ✅ Service kept intentionally small and pure around hashing/query assembly |
| 1.4 | `src/modules/auth/auth-session.service.spec.ts` | Unit | N/A (new service/spec) | ✅ Used the RED from task 1.3 before schema/service edits | ✅ `pnpm test -- --runTestsByPath src/modules/auth/auth-session.service.spec.ts` → 1 suite, 4 tests passed | ✅ Included separate create/query behaviors and family-id branches | ✅ Migration SQL refined with partial active indexes while tests stayed green |
| 2.1 | `src/modules/auth/auth.service.spec.ts` | Unit | ✅ `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts` → 1 suite, 10 tests passed | ✅ Added failing login-refresh-session and refresh-rotation assertions first; run failed with 1 suite failed, 7 failed / 8 passed (`service.refresh is not a function`, missing refresh fields) | ✅ Paired GREEN confirmed in task 2.2 via 2 suites, 19 tests passed | ✅ Covered login issuance, missing/unknown/inactive refresh rejection, successful rotation, and replay-family revocation | ✅ Extracted login-session issuance, access-token signing, and response mapping helpers while keeping unit tests green |
| 2.2 | `src/modules/auth/auth.service.spec.ts`, `src/modules/auth/auth-session.service.spec.ts` | Unit | ✅ `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts` → 1 suite, 10 tests passed | ✅ Used the RED from task 2.1 before service changes | ✅ `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts src/modules/auth/auth-session.service.spec.ts` → 2 suites, 19 tests passed | ✅ Forced real rotation logic with replay-family and context-metadata branches instead of hardcoded token responses | ✅ Introduced TTL resolution + token issuance in `AuthSessionService` and isolated transaction helpers in `AuthService` |
| 2.3 | `test/auth.e2e-spec.ts` | E2E | ✅ `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` → 1 suite, 7 tests passed | ✅ Added failing login-cookie and refresh-flow assertions first; run failed with 1 suite failed, 10 failed because `AuthSessionService` was not wired and refresh endpoints/cookies were absent | ✅ Paired GREEN confirmed in task 2.4 via 1 suite, 10 tests passed | ✅ Covered login cookie issuance, refresh rotation, missing-cookie generic `401`, replay-family revocation, and concurrent-session independence | ✅ Refined the in-memory auth-session harness to model hashed lookup/update flows without touching runtime code |
| 2.4 | `test/auth.e2e-spec.ts` | E2E | ✅ `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` → 1 suite, 7 tests passed | ✅ Used the RED from task 2.3 before controller/module/DTO edits | ✅ `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` → 1 suite, 10 tests passed; `pnpm build` → exit 0 | ✅ Proved both single-session rotation and sibling-session independence through different user-agent cookie flows | ✅ Switched Express imports to type-only and kept the access-token-only DTO contract while wiring cookie transport |

## Test Summary

- **Total tests written**: 21
- **Total tests passing**: 29
- **Layers used**: Unit (19), Integration (0), E2E (10)
- **Approval tests**: None — no refactoring-only task in these slices
- **Pure functions created**: 8

## Work Unit Evidence

### Work Unit 1 / PR 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/config/auth.config.spec.ts src/main.spec.ts src/modules/auth/auth-session.service.spec.ts` → exit 0, 3 suites passed, 19 tests passed |
| Runtime harness command/scenario and exact result | `N/A` — tasks.md defines Unit 1 as config/schema foundation only, so no HTTP/session runtime boundary lands yet. Supplemental compile check: `pnpm build` → exit 0. |
| Rollback boundary | Revert only `.env.example`, `package.json`, `pnpm-lock.yaml`, `src/config/auth.config.ts`, `src/config/auth.config.spec.ts`, `src/main.ts`, `src/main.spec.ts`, `src/modules/auth/auth-session.service.ts`, `src/modules/auth/auth-session.service.spec.ts`, `prisma/schema.prisma`, `prisma/migrations/20260713105353_add_auth_sessions/migration.sql`, and the four Work Unit 1 checkboxes in `openspec/changes/complete-auth-session-cycle/tasks.md`. |

### Work Unit 2 / PR 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts src/modules/auth/auth-session.service.spec.ts` → exit 0, 2 suites passed, 19 tests passed |
| Runtime harness command/scenario and exact result | `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` with `POST /auth/login` then `POST /auth/refresh` using the rotated cookie → exit 0, 1 suite passed, 10 tests passed. Supplemental compile check: `pnpm build` → exit 0. |
| Rollback boundary | Revert only `src/modules/auth/auth.service.spec.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.module.ts`, `src/modules/auth/dto/login-response.dto.ts`, `src/modules/auth/dto/refresh-response.dto.ts`, `test/auth.e2e-spec.ts`, and the four Work Unit 2 checkboxes in `openspec/changes/complete-auth-session-cycle/tasks.md`; keep Work Unit 1 schema/config foundation intact. |

## Correction Evidence: review-83315d59e5cd1b45 / RESILIENCE-001

Added RED/GREEN config coverage so refresh env vars may be absent while JWT env remains required; `src/config/auth.config.ts` now defaults refresh TTL/cookie values and still rejects invalid provided values. Verification: `pnpm test -- --runTestsByPath src/config/auth.config.spec.ts`, `pnpm test -- --runTestsByPath src/config/auth.config.spec.ts src/main.spec.ts`, `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts`, and `pnpm build` all passed; no Work Unit 2 endpoint behavior was added.

## Correction Evidence: review-701a175681018707 / WU2 severe refresh rotation findings

Added RED coverage for guarded same-cookie refresh consumption and access-token signing failure before rotation commit. `AuthService.refresh` now signs the access token before the rotation transaction, consumes the original session with an in-transaction `updateMany` compare-and-set before creating the replacement session, and treats a failed guarded consume as refresh replay/family revocation. Verification: `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts src/modules/auth/auth-session.service.spec.ts` → 2 suites, 21 tests passed; `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` → 1 suite, 11 tests passed; `pnpm build` → exit 0.

## Deviations from Design

None — implementation matches the Work Unit 1 + Work Unit 2 slice boundaries. The controller keeps refresh tokens out of response bodies and transports them only through the configured HttpOnly cookie.

## Issues Found

- `pnpm prisma:migrate:dev -- --name add_auth_sessions --create-only` entered Prisma's interactive prompt because the extra `--` prevented the migration name from binding. Re-running as `pnpm prisma:migrate:dev --name add_auth_sessions --create-only` succeeded.
- `nest build` initially failed with TS1272 because Express decorated handler types must use `import type` under `isolatedModules`; switching `Request`/`Response` to type-only imports fixed it without behavior changes.

## Remaining Tasks

- [ ] 3.1 RED: add failing unit/e2e tests for state-neutral `POST /auth/logout` and bearer-protected `POST /auth/logout-all` in `src/modules/auth/auth.service.spec.ts` and `test/auth.e2e-spec.ts`.
- [ ] 3.2 GREEN: implement current-session revoke and user-wide revoke paths in `src/modules/auth/auth.service.ts` and `src/modules/auth/auth.controller.ts`, including cookie clearing.
- [ ] 3.3 RED/GREEN: update `src/modules/auth/auth.openapi.spec.ts` and Swagger decorators so login/refresh/logout document cookie behavior and `logout-all` documents bearer auth.
- [ ] 4.1 Refactor auth helpers/DTO names under `src/modules/auth/` after GREEN while preserving focused auth unit/e2e coverage.
- [ ] 4.2 Run `pnpm test`, `pnpm test:e2e`, and `pnpm build`; fix only auth-session regressions and record final stacked-PR verification notes in this change folder.

## Workload / PR Boundary

- **Mode**: stacked PR slice
- **Current work unit**: Work Unit 2 / PR 2 — login cookie issuance + refresh rotation/replay defense
- **Boundary**: Starts from the landed Work Unit 1 session foundation and ends after login issues the refresh cookie, `POST /auth/refresh` rotates sessions transactionally, replay revokes the affected family, and sibling sessions remain independent. `POST /auth/logout` and `POST /auth/logout-all` remain out of scope for PR 3.
- **Estimated review budget impact**: The local stacked branch still carries Work Unit 1 + Work Unit 2 together; the intended reviewer-visible PR 2 diff is the incremental login/refresh slice on top of PR 1.

## Status

8/13 tasks complete. Ready for next batch.
