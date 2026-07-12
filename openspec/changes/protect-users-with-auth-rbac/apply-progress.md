# Apply Progress: protect-users-with-auth-rbac

## Delivery Chain

- PR 1 / `auth-login`: committed base `21138e8 feat(auth): add access token login`.
- PR 2 / `jwt-revalidation`: committed base `929a43e feat(auth): add JWT revalidation guards` plus the focused subject-validation and Prisma-failure correction preserved below.
- PR 3 / `users-admin-rbac`: protects current users routes with JWT + ADMIN RBAC, adds Bearer OpenAPI declarations, and proves `401`/`403`/ADMIN access in users E2E coverage.

## Cumulative Completed Tasks

- [x] 1.1 Login RED tests (PR1).
- [x] 1.2 JWT revalidation and users-route denial RED coverage (completed across PR2 + PR3).
- [x] 2.1 JWT/auth module configuration (PR1).
- [x] 2.2 Auth module/login implementation plus `JwtStrategy` (PR1 + PR2).
- [x] 2.3 Password verification plus authenticated-user, decorators, and guards (PR1 + PR2).
- [x] 3.2 Users controller JWT/ADMIN protection plus explicit `401`/`403` Swagger responses (PR3).
- [x] 3.3 Global Swagger Bearer scheme and protected/public OpenAPI assertions (PR3).
- [x] 4.1 Auth/users/unit/OpenAPI/E2E suites green, including stale-token denial coverage in `JwtStrategy` tests (PR3).
- [x] 4.2 Full verification commands passed for the stacked PR3 slice (PR3).

## Intentionally Pending Tasks

- [ ] 1.3 remains pending because PR3 did not implement shared email normalization or new users-service/password-hasher RED coverage.
- [ ] 3.1 remains pending because email-normalizer persistence changes are explicitly outside this PR3 scope.

## PR1 Evidence Preserved

- `POST /auth/login` normalizes lookup, verifies Argon2 passwords, provides uniform invalid/inactive `401`, and returns an access token only.
- `pnpm test` -> exit 0, 12 suites/55 tests; `pnpm test:e2e` -> exit 0, 3 suites/19 tests; `pnpm lint` -> exit 0; `pnpm build` -> exit 0.

## PR2 Evidence Preserved

- Passport JWT revalidation reloads `User` and `Role` from Prisma and uses the current database role.
- The strategy, reusable guards, and request decorators (including `@CurrentUser()` for future authenticated handlers) were covered by focused unit tests before PR3 attached the JWT/RBAC guards to the users controller.
- Protected users routes, Swagger changes, token lifecycle endpoints, schema changes, and migrations remained out of scope until PR3.

## Ordinary-Review Correction: RESILIENCE-001 and RELIABILITY-001

- `JwtStrategy.validate()` rejects missing, empty, non-string, and malformed UUID `sub` claims with `UnauthorizedException` before Prisma is called.
- Prisma lookup failures emit only generic contextual observability and return `ServiceUnavailableException` with the controlled generic message `Authentication service temporarily unavailable.`
- The focused-test guard rejects `fit`, `fdescribe`, and `fit.each` aliases without flagging comments or string literals.

## PR3 Implementation Notes

- `UsersController` now applies `JwtAuthGuard`, `RolesGuard`, and `@Roles(UserRole.ADMIN)` at the controller boundary for `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id`.
- Protected users operations now publish `@ApiBearerAuth('bearer')` and explicit `401`/`403` responses while `POST /auth/login` remains public.
- Swagger setup now exposes a reusable global Bearer scheme builder so contract tests and runtime docs share the same auth definition.
- Users E2E now proves anonymous callers get `401`, authenticated non-ADMIN callers get `403`, and authenticated ADMIN callers can use every protected users route.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 (PR1) | `src/modules/auth/auth.service.spec.ts`, `src/modules/auth/auth.openapi.spec.ts`, `test/auth.e2e-spec.ts` | Unit + OpenAPI + E2E | Preserved from PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. |
| 1.2 (PR2 + PR3) | `src/modules/auth/jwt.strategy.spec.ts`, `src/common/guards/roles.guard.spec.ts`, `test/users.e2e-spec.ts` | Unit + E2E | Baseline: `pnpm test -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts` -> exit 0, 3 suites/11 tests; `pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts` -> exit 0, 1 suite/13 tests. | Added users-route `401`/`403` expectations and OpenAPI/controller protection assertions first; focused unit command -> exit 1 with 8 failures, focused E2E command -> exit 1 with 8 failures. | Focused unit command -> exit 0, 3 suites/12 tests. Focused E2E command -> exit 0, 1 suite/21 tests. | Covered anonymous denial, non-ADMIN denial, and ADMIN success across all four protected users routes while preserving existing validation/not-found/conflict cases under ADMIN auth. | Extracted a shared Swagger builder and kept controller-level guard metadata to avoid duplicating per-route auth decorators. |
| 2.1 (PR1) | `src/config/auth.config.spec.ts` | Unit | Preserved from PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. |
| 2.2 (PR2) | `src/modules/auth/jwt.strategy.spec.ts` | Unit | Baseline: `pnpm test -- --runTestsByPath src/modules/auth/jwt.strategy.spec.ts` -> exit 0, 1 suite/3 tests. | Added Prisma rejection and four invalid-`sub` cases first; exit 1, 5 new failures. | Same focused command -> exit 0, 1 suite/8 tests. | Covered missing, empty, non-string, malformed UUID subjects, plus Prisma rejection and existing active/inactive user branches. | Added `isValidSubject()` to isolate UUID validation; focused tests remained green. |
| 2.3 (PR2) | `src/common/guards/roles.guard.spec.ts`, `src/common/decorators/auth-request.decorators.spec.ts` | Unit | Preserved from PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. |
| 3.2 (PR3) | `src/modules/users/users.controller.spec.ts`, `test/users.e2e-spec.ts` | Unit + E2E | Baseline preserved in the 1.2 row. | Added controller guard metadata assertion and route-level anonymous/non-ADMIN denials before controller changes. | Same focused commands green after controller protection changes. | Covered controller metadata plus request-level `401`, `403`, and ADMIN-success behavior on each current users endpoint. | Applied class-level guards/roles/docs once so every current users operation stays consistent. |
| 3.3 (PR3) | `src/modules/users/users.openapi.spec.ts`, `src/modules/auth/auth.openapi.spec.ts` | OpenAPI | Baseline preserved in the 1.2 row. | Replaced bootstrap-public expectations with Bearer security-scheme and protected/public auth contract assertions before changing Swagger config. | Focused unit command -> exit 0, both OpenAPI suites green with Bearer declarations. | Covered protected users operations plus the public login route against the shared Swagger builder. | Introduced `createSwaggerDocumentBuilder()` so runtime docs and specs use the same Bearer scheme definition. |
| 4.1 (PR3) | `src/modules/auth/*.spec.ts`, `src/modules/users/*.spec.ts`, `test/*.e2e-spec.ts` | Unit + OpenAPI + E2E | Focused baselines preserved above. | RED inherited from 1.2/3.2/3.3 before the full suite was re-run. | `pnpm test` -> exit 0, 15 suites/73 tests. `pnpm test:e2e` -> exit 0, 3 suites/27 tests. | Full green coverage now includes stale-token denial in `src/modules/auth/jwt.strategy.spec.ts` plus the expanded users-route access matrix. | No further refactor needed after the focused helpers and shared Swagger builder stabilized the slice. |
| 4.2 (PR3) | repository verification commands | Runtime verification | N/A (verification task). | Verification command list was fixed by the task plan before execution. | `pnpm test` -> exit 0; `pnpm test:e2e` -> exit 0; `pnpm lint` -> exit 0; `pnpm build` -> exit 0. | Triangulation skipped: this task is a single verification checklist with one acceptable outcome (all commands green). | None needed. |
| RELIABILITY-001 (PR2 correction) | `src/testing/focused-test-guard.spec.ts` | Unit | `pnpm test -- --runTestsByPath src/testing/focused-test-guard.spec.ts` -> exit 0, 1 suite/10 tests. | Added `fit(...)`, `fdescribe(...)`, and Jest-supported `fit.each(...)` cases first; exit 1, 3 failures. | Same focused command -> exit 0, 1 suite/13 tests. | Covered direct aliases, the parameterized alias, and aliases inside comments/strings. | None needed; additive pattern table preserves the existing sanitizer. |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts` -> exit 0, 3 suites passed, 12 tests passed. `pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts` -> exit 0, 1 suite passed, 21 tests passed. |
| Runtime harness command/scenario and exact result | `pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts` -> exit 0, 1 suite passed, 21 tests passed. Scenario: anonymous callers receive `401`, authenticated non-ADMIN callers receive `403`, and authenticated ADMIN callers can use all four protected users routes while legacy validation/error cases still behave under auth. |
| Supplemental required verification | `pnpm test` -> exit 0, 15 suites passed, 73 tests passed. `pnpm test:e2e` -> exit 0, 3 suites passed, 27 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/modules/users/users.controller.ts`, `src/modules/users/users.controller.spec.ts`, `src/modules/users/users.openapi.spec.ts`, `src/modules/auth/auth.openapi.spec.ts`, `src/config/swagger.config.ts`, and `test/users.e2e-spec.ts`; this removes PR3 route/docs protection without touching PR1 login or PR2 JWT revalidation internals. |

## Correction Work Unit Evidence (Preserved)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Baseline: `pnpm test -- --runTestsByPath src/testing/focused-test-guard.spec.ts` -> exit 0, 1 suite passed, 10 tests passed. RED: same command -> exit 1, 3 failed / 10 passed. GREEN: same command -> exit 0, 1 suite passed, 13 tests passed. |
| Runtime harness command/scenario and exact result | `pnpm test` executes the configured `pretest` guard against `./src ./test` before Jest; exit 0, 15 suites passed, 72 tests passed. This exercises the actual CI/pretest path. |
| Required full verification | `pnpm test:e2e` -> exit 0, 3 suites passed, 19 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/testing/focused-test-guard.ts` and `src/testing/focused-test-guard.spec.ts`; restores prior alias coverage without affecting Auth/RBAC implementation files. |

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

- 9/11 planned task lines are now complete.
- Remaining unchecked work is limited to email normalization (`1.3`, `3.1`).
- PR3 `users-admin-rbac` is implemented and verified; the next recommended implementation slice is the pending email-normalization follow-up, otherwise verification/review can consume this slice now.
