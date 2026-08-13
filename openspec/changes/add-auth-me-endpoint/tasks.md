# Tasks: Add Auth Me Endpoint

## Review Workload Forecast

| Field | Value |
|---|---|
| Current API-2 changed lines | 361 |
| Review budget | 400 changed lines |
| Delivery strategy | stacked-to-main |
| Current branch / base | `test/auth-me-e2e` / `feat/auth-me` |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

## Phase 1: API-1 Safe Bootstrap Endpoint

- [x] 1.1 Add the safe DTO, service query, controller route, unit tests, OpenAPI contract tests, and lint cleanup.
- [x] 1.2 Verify API-1 with 23 focused tests, full unit suite, lint, and build.

## Phase 2: API-2 E2E and SDD Closure

- [x] 2.1 Cover active and neutral bootstrap responses, forced-password precedence, absent bearer, revoked session, inactive membership, and sensitive-field exclusion in `test/auth.e2e-spec.ts`.
- [x] 2.2 Confirm API-2 adds no schema migration, token issuance/rotation, permission expansion, or unrelated endpoint behavior.
- [x] 2.3 Run focused and full E2E, full unit tests, lint, and build.
- [x] 2.4 Finalize proposal, design, delta spec, tasks, and apply evidence with the actual API-2 results and rollback boundary.
