# Apply Progress: protect-users-with-auth-rbac

## Delivery Chain

- PR 1 / `auth-login`: committed base `21138e8 feat(auth): add access token login`.
- PR 2 / `jwt-revalidation`: stacked PR slice; this ordinary-review correction is limited to JWT subject validation and Prisma-failure degradation.
- PR 3 / `users-admin-rbac`: remains pending and owns users-route guards, Swagger Bearer declarations, and users-route `401`/`403` E2E assertions.

## Cumulative Completed Tasks

- [x] 1.1 Login RED tests (PR1).
- [x] 2.1 JWT/auth module configuration (PR1).
- [x] 2.2 Auth module/login implementation plus `JwtStrategy` (PR1 + PR2).
- [x] 2.3 Password verification plus authenticated-user, decorators, and guards (PR1 + PR2).

## Intentionally Pending Tasks

- [ ] 1.2 remains unchecked because PR3 owns truthful users-route `401`/`403` E2E assertions.
- [ ] 1.3, 3.1, 3.2, 3.3, 4.1, and 4.2 remain assigned to later scope.

## PR1 Evidence Preserved

- `POST /auth/login` normalizes lookup, verifies Argon2 passwords, provides uniform invalid/inactive `401`, and returns an access token only.
- `pnpm test` -> exit 0, 12 suites/55 tests; `pnpm test:e2e` -> exit 0, 3 suites/19 tests; `pnpm lint` -> exit 0; `pnpm build` -> exit 0.

## PR2 Evidence Preserved

- Passport JWT revalidation reloads `User` and `Role` from Prisma and uses the current database role.
- The strategy, reusable guards, and request decorators were covered by focused unit tests before the correction.
- Protected users routes, Swagger changes, token lifecycle endpoints, schema changes, and migrations remain out of scope.

## Ordinary-Review Correction: RESILIENCE-001 and RELIABILITY-001

- `JwtStrategy.validate()` now rejects missing, empty, non-string, and malformed UUID `sub` claims with `UnauthorizedException` before Prisma is called.
- Prisma lookup failures now emit only generic contextual observability and return `ServiceUnavailableException` with the controlled generic message `Authentication service temporarily unavailable.`
- No user ID, JWT subject, or Prisma error detail is logged by the strategy failure path.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 (PR1) | `src/modules/auth/auth.service.spec.ts`, `src/modules/auth/auth.openapi.spec.ts`, `test/auth.e2e-spec.ts` | Unit + OpenAPI + E2E | Preserved from PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. |
| 2.1 (PR1) | `src/config/auth.config.spec.ts` | Unit | Preserved from PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. | Captured in PR1. |
| 2.2 (PR2) | `src/modules/auth/jwt.strategy.spec.ts` | Unit | Baseline: `pnpm test -- --runTestsByPath src/modules/auth/jwt.strategy.spec.ts` -> exit 0, 1 suite/3 tests. | Added Prisma rejection and four invalid-`sub` cases first; exit 1, 5 new failures. | Same focused command -> exit 0, 1 suite/8 tests. | Covered missing, empty, non-string, malformed UUID subjects, plus Prisma rejection and existing active/inactive user branches. | Added `isValidSubject()` to isolate UUID validation; focused tests remained green. |
| 2.3 (PR2) | `src/common/guards/roles.guard.spec.ts`, `src/common/decorators/auth-request.decorators.spec.ts` | Unit | Preserved from PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. | Captured in PR2. |
| RELIABILITY-001 (PR2 correction) | `src/testing/focused-test-guard.spec.ts` | Unit | `pnpm test -- --runTestsByPath src/testing/focused-test-guard.spec.ts` -> exit 0, 1 suite/10 tests. | Added `fit(...)`, `fdescribe(...)`, and Jest-supported `fit.each(...)` cases first; exit 1, 3 failures. | Same focused command -> exit 0, 1 suite/13 tests. | Covered direct aliases, the parameterized alias, and aliases inside comments/strings. | None needed; additive pattern table preserves the existing sanitizer. |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test -- --runTestsByPath src/modules/auth/jwt.strategy.spec.ts` -> exit 0, 1 suite passed, 8 tests passed. |
| Runtime harness command/scenario and exact result | N/A for the correction itself: PR2 intentionally does not attach `JwtAuthGuard` to a route, so no real guarded endpoint invokes `JwtStrategy.validate()`. Full runtime regression harness: `pnpm test:e2e` -> exit 0, 3 suites passed, 19 tests passed. |
| Supplemental required verification | `pnpm test` -> exit 0, 15 suites passed, 69 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/modules/auth/jwt.strategy.ts` and `src/modules/auth/jwt.strategy.spec.ts`; this removes the correction without affecting the rest of PR2 or any PR3-owned users-route behavior. |

## Ordinary-Review Correction: RELIABILITY-001 Focused-Test Aliases

- Added `fit`, `fdescribe`, and Jest-supported `fit.each` detection to the pretest focused-test guard.
- The scanner still removes comments and string/template literal contents before evaluating focused markers, so aliases in non-executable text remain allowed.
- Scope is limited to `src/testing/focused-test-guard.ts` and `src/testing/focused-test-guard.spec.ts`; no auth behavior or PR3-owned route behavior changed.

## Correction Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Baseline: `pnpm test -- --runTestsByPath src/testing/focused-test-guard.spec.ts` -> exit 0, 1 suite passed, 10 tests passed. RED: same command -> exit 1, 3 failed / 10 passed. GREEN: same command -> exit 0, 1 suite passed, 13 tests passed. |
| Runtime harness command/scenario and exact result | `pnpm test` executes the configured `pretest` guard against `./src ./test` before Jest; exit 0, 15 suites passed, 72 tests passed. This exercises the actual CI/pretest path. |
| Required full verification | `pnpm test:e2e` -> exit 0, 3 suites passed, 19 tests passed. `pnpm lint` -> exit 0. `pnpm build` -> exit 0. |
| Rollback boundary | Revert only `src/testing/focused-test-guard.ts` and `src/testing/focused-test-guard.spec.ts`; restores prior alias coverage without affecting Auth/RBAC implementation files. |

## Native Remediation Lineage Status

The supplied lineage is still in `reviewing` state and contains no native `fix_batch` or `failed_evidence_revision`. This correction is implemented and verified, but must not be represented as a completed native remediation receipt until the review workflow persists those exact values.

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

- 4/11 planned task lines complete; task checkboxes remain unchanged because this correction completes no new planned task.
- The RELIABILITY-001 focused-test alias correction is implemented and verified; its native remediation receipt remains blocked on required transaction metadata. PR3 `users-admin-rbac` remains the next implementation slice.
