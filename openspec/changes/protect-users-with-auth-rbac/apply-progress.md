# Apply Progress: protect-users-with-auth-rbac

## Delivery Chain

- PR 1 / `auth-login`: committed base `21138e8 feat(auth): add access token login`.
- PR 2 / `jwt-revalidation`: committed base `929a43e feat(auth): add JWT revalidation guards` plus the focused subject-validation and Prisma-failure correction preserved below.
- PR 3 / `users-admin-rbac`: committed base `ead644f feat(auth): protect users with admin RBAC` and added JWT + ADMIN protection plus Bearer OpenAPI declarations for current users routes.
- Follow-up email-normalization slice: uncommitted stacked follow-up that completes the remaining shared normalization work without expanding scope beyond tasks `1.3` and `3.1`.

## Cumulative Completed Tasks

- [x] 1.1 Login RED tests (PR1).
- [x] 1.2 JWT revalidation and users-route denial RED coverage (completed across PR2 + PR3).
- [x] 1.3 Shared email-normalization RED coverage via utility and users-service tests, while preserving Argon2 verify coverage.
- [x] 2.1 JWT/auth module configuration (PR1).
- [x] 2.2 Auth module/login implementation plus `JwtStrategy` (PR1 + PR2).
- [x] 2.3 Password verification plus authenticated-user, decorators, and guards (PR1 + PR2).
- [x] 3.1 Shared `normalizeEmail()` utility wired into users create/update persistence and reused by auth login.
- [x] 3.2 Users controller JWT/ADMIN protection plus explicit `401`/`403` Swagger responses (PR3).
- [x] 3.3 Global Swagger Bearer scheme and protected/public OpenAPI assertions (PR3).
- [x] 4.1 Auth/users/unit/OpenAPI/E2E suites green, including stale-token denial coverage in `JwtStrategy` tests and normalized email persistence coverage.
- [x] 4.2 Full verification commands passed for the stacked change, including the email-normalization follow-up.

## PR1 Evidence Preserved

- `POST /auth/login` normalizes lookup, verifies Argon2 passwords, provides uniform invalid/inactive `401`, and returns an access token only.
- Historical PR1 verification: `pnpm test` -> exit 0, 12 suites/55 tests; `pnpm test:e2e` -> exit 0, 3 suites/19 tests; `pnpm lint` -> exit 0; `pnpm build` -> exit 0.

## PR2 Evidence Preserved

- Passport JWT revalidation reloads `User` and `Role` from Prisma and uses the current database role.
- The strategy, reusable guards, and request decorators (including `@CurrentUser()` for future authenticated handlers) were covered by focused unit tests before PR3 attached the JWT/RBAC guards to the users controller.
- Protected users routes, Swagger changes, token lifecycle endpoints, schema changes, and migrations remained out of scope until PR3.

## Ordinary-Review Correction: RESILIENCE-001 and RELIABILITY-001

- `JwtStrategy.validate()` rejects missing, empty, non-string, and malformed UUID `sub` claims with `UnauthorizedException` before Prisma is called.
- Prisma lookup failures emit only generic contextual observability and return `ServiceUnavailableException` with the controlled generic message `Authentication service temporarily unavailable.`
- The focused-test guard rejects `fit`, `fdescribe`, and `fit.each` aliases without flagging comments or string literals.

## Email Normalization Follow-up Notes

- Added `src/common/utils/email-normalizer.ts` with shared trim + lowercase normalization and covered it with focused unit tests.
- `UsersService.create()` and `UsersService.update()` now normalize emails before Prisma writes, so uniqueness and persisted identity align with login lookup behavior.
- `AuthService.login()` now reuses the shared normalizer, prefers an exact normalized lookup, and falls back to a deterministic case-insensitive compatibility query so legacy mixed-case stored emails can still authenticate safely.
- `CreateUserDto` and `UpdateUserDto` now trim email inputs before validation, so HTTP create/update flows accept trim-normalizable values and still persist normalized lowercase emails through the service layer.
- No schema changes, migrations, refresh-token work, or RBAC scope changes were introduced.

## Review Correction: legacy-email compatibility + DTO trim normalization

- Fixed the corroborated auth lockout path where login normalized the submitted email and then relied on `findUnique`, which misses pre-existing mixed-case stored emails under PostgreSQL case-sensitive `TEXT` equality.
- Added a deterministic compatibility lookup: exact normalized `findUnique` first, then case-insensitive `findMany(... take: 2)` fallback, rejecting ambiguous legacy duplicates with the same `401 Invalid credentials.` response.
- Added DTO-level email trimming for public create/update paths and exercised it through HTTP tests so validation behavior now matches service normalization.

## Final Review Correction: case-insensitive duplicate prevention before users writes

- `UsersService.create()` now performs an application-level case-insensitive duplicate lookup before hashing or persisting, so legacy mixed-case rows cannot coexist with a new normalized lowercase write.
- `UsersService.update()` performs the same duplicate lookup while excluding the current user id, preventing mixed-case collisions without blocking a user from keeping their own normalized email.
- `AuthService.login()` now fails closed when an exact lowercase row and a legacy mixed-case duplicate both exist, instead of silently selecting the lowercase record.
- No migrations, backfills, refresh/logout/me work, permissions-table RBAC, or unrelated auth changes were introduced.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 (PR1) | `src/modules/auth/auth.service.spec.ts`, `src/modules/auth/auth.openapi.spec.ts`, `test/auth.e2e-spec.ts` | Unit + OpenAPI + E2E | Preserved from PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. |
| 1.2 (PR2 + PR3) | `src/modules/auth/jwt.strategy.spec.ts`, `src/common/guards/roles.guard.spec.ts`, `test/users.e2e-spec.ts` | Unit + E2E | Preserved from PR2 + PR3. | Captured in PR2 + PR3. | Captured in PR2 + PR3. | Captured in PR2 + PR3. | Captured in PR2 + PR3. |
| 1.3 (follow-up) | `src/common/utils/email-normalizer.spec.ts`, `src/modules/users/users.service.spec.ts`, `src/common/security/password-hasher.service.spec.ts` | Unit | `pnpm test -- --runTestsByPath src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts src/common/security/password-hasher.service.spec.ts` -> exit 0, 3 suites/20 tests. | Added utility test importing a missing module plus create/update normalization expectations first; `pnpm test -- --runTestsByPath src/common/utils/email-normalizer.spec.ts src/modules/users/users.service.spec.ts` -> exit 1, 2 suites failed, 2 failed / 9 passed / 11 total. | `pnpm test -- --runTestsByPath src/common/utils/email-normalizer.spec.ts src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 0, 3 suites/20 tests. | Covered trim + lowercase normalization, already-normalized pass-through, normalized create writes, and normalized update writes. Existing Argon2 verify coverage remained green in `password-hasher.service.spec.ts`. | Reused one shared normalizer in auth and users flows instead of keeping duplicated trim/lowercase logic. |
| 2.1 (PR1) | `src/config/auth.config.spec.ts` | Unit | Preserved from PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. |
| 2.2 (PR2) | `src/modules/auth/jwt.strategy.spec.ts` | Unit | Preserved from PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. |
| 2.3 (PR2) | `src/common/guards/roles.guard.spec.ts`, `src/common/decorators/auth-request.decorators.spec.ts`, `src/common/security/password-hasher.service.spec.ts` | Unit | Preserved from PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. |
| 3.1 (follow-up) | `src/common/utils/email-normalizer.spec.ts`, `src/modules/users/users.service.spec.ts`, `src/modules/auth/auth.service.spec.ts` | Unit | `pnpm test -- --runTestsByPath src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts src/common/security/password-hasher.service.spec.ts` -> exit 0, 3 suites/20 tests. | Same RED cycle as task `1.3`, because the missing utility and non-normalized Prisma writes blocked the implementation slice together. | `pnpm test -- --runTestsByPath src/common/utils/email-normalizer.spec.ts src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 0, 3 suites/20 tests. | Covered utility behavior plus create/update persistence, while auth login approval coverage still proved normalized lookup behavior with the shared utility. | `AuthService` now imports `normalizeEmail()` so login and persistence use the same implementation without changing the auth contract. |
| 3.2 (PR3) | `src/modules/users/users.controller.spec.ts`, `test/users.e2e-spec.ts` | Unit + E2E | Preserved from PR3. | Captured in PR3. | Captured in PR3. | Captured in PR3. | Captured in PR3. |
| 3.3 (PR3) | `src/modules/users/users.openapi.spec.ts`, `src/modules/auth/auth.openapi.spec.ts` | OpenAPI | Preserved from PR3. | Captured in PR3. | Captured in PR3. | Captured in PR3. | Captured in PR3. |
| 4.1 (full change rerun) | `src/**/*.spec.ts`, `test/**/*.e2e-spec.ts` | Unit + OpenAPI + E2E | Focused baselines preserved above. | RED inherited from the original slices plus follow-up task `1.3`/`3.1` and the review-correction RED cycle below. | `pnpm test` -> exit 0, 16 suites/77 tests. `pnpm test:e2e` -> exit 0, 3 suites/28 tests. | Full green coverage now includes the shared email normalizer, legacy mixed-case login compatibility, DTO trim normalization, and the prior auth/RBAC matrix. | No further refactor needed after the compatibility lookup and DTO trimming aligned transport + persistence behavior. |
| 4.2 (full verification rerun) | repository verification commands | Runtime verification | N/A (verification task). | Verification command list was fixed by the task plan before execution. | `pnpm test` -> exit 0, 16 suites/77 tests. `pnpm test:e2e` -> exit 0, 3 suites/28 tests. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. | Triangulation skipped: this task is a single verification checklist with one acceptable outcome (all commands green). | None needed. |
| EMAIL-DUPLICATE-REVIEW-001 | `src/modules/users/users.service.spec.ts`, `src/modules/auth/auth.service.spec.ts`, `test/auth.e2e-spec.ts`, `test/users.e2e-spec.ts` | Unit + E2E | Baseline unit: `pnpm test -- --runInBand --runTestsByPath src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 0, 2 suites / 20 tests. Baseline e2e: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 0, 2 suites / 27 tests. | Unit RED: `pnpm test -- --runInBand --runTestsByPath src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 1, 2 failed suites, 3 failed / 20 passed / 23 total. E2E RED: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 1, 2 failed suites, 3 failed / 27 passed / 30 total. | Unit GREEN: `pnpm test -- --runInBand --runTestsByPath src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 0, 2 suites / 24 tests. E2E GREEN: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 0, 2 suites / 30 tests. | Covered create duplicate rejection, update duplicate rejection with same-user exclusion, and fail-closed login when lowercase plus legacy mixed-case duplicates coexist. | Extracted users duplicate protection into `ensureEmailIsAvailable()` and kept lowercase persistence unchanged so write-time normalization and auth lookup stay aligned. |
| EMAIL-NORM-REVIEW-001 | `src/modules/auth/auth.service.spec.ts`, `test/auth.e2e-spec.ts`, `test/users.e2e-spec.ts` | Unit + E2E | Prior follow-up verification already had `pnpm test` -> exit 0, 16 suites/75 tests and `pnpm test:e2e` -> exit 0, 3 suites/27 tests before this correction batch added new expectations. | Unit RED: `pnpm test -- --runInBand --runTestsByPath src/modules/auth/auth.service.spec.ts` -> exit 1, 1 failed / 8 passed / 9 total. E2E RED: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 1, 3 failed / 24 passed / 27 total. | Unit GREEN: `pnpm test -- --runInBand --runTestsByPath src/modules/auth/auth.service.spec.ts` -> exit 0, 1 suite / 9 tests. E2E GREEN: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 0, 2 suites / 27 tests. | Covered legacy mixed-case login success, deterministic rejection of ambiguous case-insensitive duplicates, and HTTP acceptance of whitespace-padded create/update emails that persist normalized lowercase values. | Extracted the compatibility behavior into `findUserForLogin()` and kept DTO trimming at the transport boundary so auth/service normalization stays aligned without widening scope. |
| RELIABILITY-001 (PR2 correction) | `src/testing/focused-test-guard.spec.ts` | Unit | Preserved from PR2 correction. | Captured in PR2 correction. | Captured in PR2 correction. | Captured in PR2 correction. | Captured in PR2 correction. |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/common/utils/email-normalizer.spec.ts src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 0, 3 suites passed, 20 tests passed. |
| Runtime harness command/scenario and exact result | `pnpm test:e2e` -> exit 0, 3 suites passed, 27 tests passed. Scenario: full HTTP login and users-route suites remained green, proving the shared normalizer refactor did not regress auth issuance, JWT/RBAC denial rules, or ADMIN access behavior. |
| Supplemental required verification | `pnpm test` -> exit 0, 16 suites passed, 75 tests passed. `pnpm test:e2e` -> exit 0, 3 suites passed, 27 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/common/utils/email-normalizer.ts`, `src/common/utils/email-normalizer.spec.ts`, `src/modules/users/users.service.ts`, `src/modules/users/users.service.spec.ts`, and `src/modules/auth/auth.service.ts`; this removes the email-normalization follow-up without touching JWT/RBAC route protection or prior correction files. |

## Correction Work Unit Evidence (Preserved)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Baseline: `pnpm test -- --runTestsByPath src/testing/focused-test-guard.spec.ts` -> exit 0, 1 suite passed, 10 tests passed. RED: same command -> exit 1, 3 failed / 10 passed. GREEN: same command -> exit 0, 1 suite passed, 13 tests passed. |
| Runtime harness command/scenario and exact result | `pnpm test` executes the configured `pretest` guard against `./src ./test` before Jest; exit 0, 15 suites passed, 72 tests passed. This exercises the actual CI/pretest path. |
| Required full verification | `pnpm test:e2e` -> exit 0, 3 suites passed, 19 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/testing/focused-test-guard.ts` and `src/testing/focused-test-guard.spec.ts`; restores prior alias coverage without affecting Auth/RBAC implementation files. |

## Email-Normalization Review Correction Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED unit: `pnpm test -- --runInBand --runTestsByPath src/modules/auth/auth.service.spec.ts` -> exit 1, 1 failed / 8 passed / 9 total. GREEN unit: same command -> exit 0, 1 suite passed, 9 tests passed. |
| Runtime harness command/scenario and exact result | RED e2e: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 1, 3 failed / 24 passed / 27 total. GREEN e2e: same command -> exit 0, 2 suites passed, 27 tests passed. Scenario: login succeeds for a legacy mixed-case stored email, and ADMIN create/update requests accept whitespace-padded emails while persisting normalized lowercase values. |
| Supplemental required verification | `pnpm test` -> exit 0, 16 suites passed, 77 tests passed. `pnpm test:e2e` -> exit 0, 3 suites passed, 28 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.service.spec.ts`, `src/modules/users/dto/create-user.dto.ts`, `src/modules/users/dto/update-user.dto.ts`, `test/auth.e2e-spec.ts`, and `test/users.e2e-spec.ts`; this removes the compatibility lookup and DTO trim correction without touching prior JWT/RBAC slices or schema state. |

## Final Duplicate-Prevention Correction Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED unit: `pnpm test -- --runInBand --runTestsByPath src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts` -> exit 1, 2 failed suites, 3 failed / 20 passed / 23 total. GREEN unit: same command -> exit 0, 2 suites passed, 24 tests passed. |
| Runtime harness command/scenario and exact result | RED e2e: `pnpm test:e2e -- --runInBand --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` -> exit 1, 2 failed suites, 3 failed / 27 passed / 30 total. GREEN e2e: same command -> exit 0, 2 suites passed, 30 tests passed. Scenario: ADMIN create/update requests reject legacy mixed-case duplicates before Prisma writes, and login returns `401` when lowercase and mixed-case duplicate identities coexist. |
| Supplemental required verification | `pnpm test` -> exit 0, 16 suites passed, 81 tests passed. `pnpm test:e2e` -> exit 0, 3 suites passed, 31 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/modules/users/users.service.ts`, `src/modules/users/users.service.spec.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.service.spec.ts`, `test/auth.e2e-spec.ts`, and `test/users.e2e-spec.ts`; this removes the final duplicate-prevention correction without touching JWT revalidation, users-route RBAC, or schema state. |

## Native Remediation Lineage Status

The preserved PR2 correction lineage is still in `reviewing` state and contains no native `fix_batch` or `failed_evidence_revision`. The correction remains implemented and verified, but must not be represented as a completed native remediation receipt until the review workflow persists those exact values.

```yaml
schema: gentle-ai.remediation-result/v1
lineage_id: protect-users-with-auth-rbac-pr2-jwt-revalidation-final
generation: 1
mode: ordinary-review-correction
fix_batch: unavailable
failed_evidence_revision: unavailable
status: blocked_on_native_receipt_metadata
finding_id: RELIABILITY-001
```

```json
{"schema":"gentle-ai.remediation-evidence/v1","lineage_id":"protect-users-with-auth-rbac-pr2-jwt-revalidation-final","generation":1,"mode":"ordinary-review-correction","fix_batch":null,"failed_evidence_revision":null,"finding_id":"RELIABILITY-001","focused_test":{"command":"pnpm test -- --runTestsByPath src/testing/focused-test-guard.spec.ts","result":"exit 0; 1 suite; 13 tests"},"runtime_harness":{"command":"pnpm test","result":"exit 0; 15 suites; 72 tests"},"full_verification":{"test_e2e":"exit 0; 3 suites; 19 tests","lint":"exit 0","build":"exit 0"}}
```

## Status

- 11/11 planned task lines are now complete.
- The full change remains 11/11 complete and now includes the final case-insensitive duplicate-prevention correction for users writes plus fail-closed auth ambiguity handling.
- Next recommended phase is verification/review for the complete `protect-users-with-auth-rbac` change.
