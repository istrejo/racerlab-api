# Proposal: Protect Users With Auth RBAC

## Proposal question round
- Assumptions to confirm later: ADMIN owns all users endpoints in slice one; inactive users lose access immediately; refresh/logout/session rotation wait for the next chained slice.
- Open questions: Should login reject inactive users with the same response as bad credentials? Should user emails be normalized to lowercase for both create and login? Does any current workflow require non-ADMIN read access before the follow-up slice?

## Intent
Close the public-users security gap by replacing bootstrap-only access with JWT access-token auth and enum-role RBAC, while keeping NestJS as the business layer and Swagger as the contract source.

## Scope
### In Scope
- Add `POST /auth/login` with Argon2 password verification and JWT access-token issuance.
- Add shared JWT/RBAC guards and decorators, plus Swagger Bearer documentation.
- Protect `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id` as ADMIN-only.

### Out of Scope
- Refresh tokens, logout, session rotation, and `/auth/refresh` or `/auth/me`.
- Permissions-table RBAC, schema changes, migrations, and frontend changes.

## Capabilities
### New Capabilities
- `user-auth`: Login, access-token issuance, JWT validation, and active-user reload.
- `users-access-control`: Authenticated ADMIN-only access rules for users endpoints.

### Modified Capabilities
- None.

## Approach
Create `AuthModule` with controller/service/DTOs, extend `PasswordHasherService` with `verify()`, issue access tokens via `JwtService`, and make `JwtStrategy` reload the current user by `id` + `isActive`. `RolesGuard` checks `UserRole` enum roles only.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/auth/*` | New | Login flow, JWT issuance, strategy, DTOs |
| `src/common/guards/*`, `src/common/decorators/*` | New | Shared auth and role enforcement |
| `src/modules/users/users.controller.ts` | Modified | Replace public bootstrap docs/decorators with ADMIN protection |
| `src/common/security/password-hasher.service.ts` | Modified | Add password verification |
| `src/config/swagger.config.ts`, `test/users.e2e-spec.ts`, `src/modules/users/users.openapi.spec.ts` | Modified | Bearer contract and protected-route tests |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unclear non-ADMIN access policy | Med | Freeze ADMIN-only in this slice |
| Stale token claims after role/deactivation change | Med | Reload user on every JWT validation |
| Bootstrap tests break during transition | High | Replace public-route assertions with `401/403` and authenticated coverage |

## Rollback Plan
Revert `AuthModule`, shared guards/decorators, Swagger Bearer config, and users-route protection in one slice; restore prior public users contract and tests.

## Dependencies
- JWT auth packages and stable secret/TTL configuration without exposing secrets.

## Success Criteria
- [ ] Users endpoints require a valid JWT and return `403` for authenticated non-ADMIN roles.
- [ ] `POST /auth/login` issues an access token only for valid active users with correct passwords.
