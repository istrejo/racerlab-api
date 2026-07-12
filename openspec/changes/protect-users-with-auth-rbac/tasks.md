# Tasks: Protect Users With Auth RBAC

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520-700 |
| 800-line budget risk | Medium |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 auth-login -> PR 2 jwt-revalidation -> PR 3 users-admin-rbac |
| PR strategy | force-chained |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |
| Recommended next slice for apply | PR 1 auth-login |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
800-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Ship access-token login only | PR 1 (base: main) | `pnpm test -- auth.service.spec.ts auth.openapi.spec.ts` | `pnpm test:e2e -- auth.e2e-spec.ts` | `src/modules/auth/**`, `src/config/auth.config.ts`, auth deps |
| 2 | Add JWT revalidation plumbing | PR 2 (base: main after PR 1) | `pnpm test -- jwt.strategy.spec.ts roles.guard.spec.ts` | `pnpm test:e2e -- users.e2e-spec.ts -t "401|403"` | `src/common/auth/**`, `src/common/guards/**`, `src/common/decorators/**` |
| 3 | Lock users routes and docs | PR 3 (base: main after PR 2) | `pnpm test -- users.controller.spec.ts users.openapi.spec.ts users.service.spec.ts` | `pnpm test:e2e -- users.e2e-spec.ts` | `src/modules/users/**`, `src/config/swagger.config.ts` |

## Phase 1: RED Tests

- [x] 1.1 Add failing `src/modules/auth/auth.service.spec.ts` and `test/auth.e2e-spec.ts` for login success, uniform `401`, and access-token-only response.
- [x] 1.2 Add failing `src/modules/auth/jwt.strategy.spec.ts`, `src/common/guards/roles.guard.spec.ts`, and `test/users.e2e-spec.ts` for active-user reload, `401` anonymous, and `403` non-ADMIN denial.
- [x] 1.3 Extend `src/modules/users/users.service.spec.ts`, add `src/common/utils/email-normalizer.spec.ts`, and update `src/common/security/password-hasher.service.spec.ts` for lowercase/trim normalization and Argon2 verify.

## Phase 2: Auth Slice

- [x] 2.1 Update `package.json`, `pnpm-lock.yaml`, `src/app.module.ts`, and create `src/config/auth.config.ts` for JWT/passport wiring with fail-fast secret/TTL config.
- [x] 2.2 Create `src/modules/auth/{auth.module.ts,auth.controller.ts,auth.service.ts,dto/login.dto.ts,dto/login-response.dto.ts,jwt.strategy.ts}` for normalized login, token signing, and uniform invalid/inactive rejection.
- [x] 2.3 Create `src/common/auth/authenticated-user.ts`, `src/common/decorators/{current-user.decorator.ts,roles.decorator.ts}`, `src/common/guards/{jwt-auth.guard.ts,roles.guard.ts}`, and add `verify()` to `src/common/security/password-hasher.service.ts`.

## Phase 3: Users Protection

- [x] 3.1 Create `src/common/utils/email-normalizer.ts` and update `src/modules/users/users.service.ts` to normalize create/update emails before Prisma writes.
- [x] 3.2 Update `src/modules/users/users.controller.ts` with `JwtAuthGuard`, `RolesGuard`, `@Roles(UserRole.ADMIN)`, and explicit `401/403` Swagger responses on all current routes.
- [x] 3.3 Update `src/config/swagger.config.ts` and create `src/modules/auth/auth.openapi.spec.ts` so Bearer auth is declared for protected users routes while `POST /auth/login` stays public.

## Phase 4: GREEN / Verify

- [x] 4.1 Make `src/modules/auth/*.spec.ts`, `src/modules/users/*.spec.ts`, and `test/*.e2e-spec.ts` GREEN, including stale-token denial after deactivation or role change.
- [x] 4.2 Run `pnpm test`, `pnpm test:e2e`, and `pnpm build`; update task checkboxes only after each stacked slice passes.
