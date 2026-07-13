# Tasks: Complete Auth Session Cycle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain (user-selected force-chained) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Session persistence/config foundation | PR 1 | `pnpm test -- auth.service.spec.ts auth.openapi.spec.ts` | N/A - no HTTP/session flow lands yet | `prisma/schema.prisma`, migration, `src/config/auth.config.ts`, `src/main.ts`, auth helpers/specs |
| 2 | Login cookie issuance + refresh rotation/replay defense | PR 2 | `pnpm test -- auth.service.spec.ts && pnpm test:e2e -- auth.e2e-spec.ts` | `POST /auth/login` then `POST /auth/refresh` with rotated cookie | Auth session logic, controller routes, DTOs, e2e/unit coverage for login/refresh |
| 3 | Logout/logout-all + Swagger contract polish | PR 3 | `pnpm test -- auth.openapi.spec.ts && pnpm test:e2e -- auth.e2e-spec.ts` | `POST /auth/logout` and bearer `POST /auth/logout-all` | Logout endpoints/docs/tests without reverting PR1-PR2 behavior |

## Phase 1: Foundation

- [x] 1.1 RED: create `src/config/auth.config.spec.ts` for refresh TTL/cookie env parsing before touching `src/config/auth.config.ts`.
- [x] 1.2 GREEN: add refresh config fields in `src/config/auth.config.ts`, document them in `.env.example`, and register cookie parser in `src/main.ts` plus `package.json`.
- [x] 1.3 RED: create `src/modules/auth/auth-session.service.spec.ts` for hash-only storage, family linkage, expiry lookup, and metadata capture.
- [x] 1.4 GREEN: add `User.authSessions` + `AuthSession` to `prisma/schema.prisma` and create the Prisma migration with unique hash and active-session indexes.

## Phase 2: Login and Refresh Core

- [x] 2.1 RED: add failing service tests for login cookie issuance, generic invalid refresh rejection, rotation, and replay-family revocation in `src/modules/auth/auth.service.spec.ts`.
- [x] 2.2 GREEN: implement refresh token generation/hash/session persistence in `src/modules/auth/auth-session.service.ts` and transactional rotate-or-revoke logic in `src/modules/auth/auth.service.ts`.
- [x] 2.3 RED: add e2e coverage in `test/auth.e2e-spec.ts` for `POST /auth/login` cookie issuance, `POST /auth/refresh`, generic `401`, and concurrent-session independence.
- [x] 2.4 GREEN: update `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.module.ts`, `src/modules/auth/dto/login-response.dto.ts`, and create `src/modules/auth/dto/refresh-response.dto.ts`.

## Phase 3: Revocation and Contract Wiring

- [ ] 3.1 RED: add failing unit/e2e tests for state-neutral `POST /auth/logout` and bearer-protected `POST /auth/logout-all` in `src/modules/auth/auth.service.spec.ts` and `test/auth.e2e-spec.ts`.
- [ ] 3.2 GREEN: implement current-session revoke and user-wide revoke paths in `src/modules/auth/auth.service.ts` and `src/modules/auth/auth.controller.ts`, including cookie clearing.
- [ ] 3.3 RED/GREEN: update `src/modules/auth/auth.openapi.spec.ts` and Swagger decorators so login/refresh/logout document cookie behavior and `logout-all` documents bearer auth.

## Phase 4: Verification and Cleanup

- [ ] 4.1 Refactor auth helpers/DTO names under `src/modules/auth/` after GREEN while preserving focused auth unit/e2e coverage.
- [ ] 4.2 Run `pnpm test`, `pnpm test:e2e`, and `pnpm build`; fix only auth-session regressions and record final stacked-PR verification notes in this change folder.
