# Design: Protect Users With Auth RBAC

## Technical Approach

Implement the first auth slice as NestJS-owned access-token authentication: `AuthModule` exposes `POST /auth/login`, verifies Argon2 hashes, issues JWT access tokens, and protected requests reload the active user from Prisma before RBAC is evaluated. Existing users endpoints move from bootstrap-public to ADMIN-only, with Swagger Bearer contract updates and strict TDD coverage replacing public-route assumptions.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Auth slice boundary | Access-token-only login and route protection | Refresh/logout/me in same slice | Closes the public users gap while keeping the forced chained PR reviewable. |
| Authorization source | JWT carries `sub`; `JwtStrategy` reloads `User` + `Role` where `isActive=true` | Trust role claims only | Deactivation/role changes take effect immediately; claims alone never authorize. |
| RBAC model | `@Roles(UserRole.ADMIN)` + enum `RolesGuard` | Permission-table RBAC | Permissions tables exist but are explicitly out of scope for slice one. |
| Email handling | Shared lowercase/trim normalization used by login, create, and update | Normalize only at login | Prevents casing drift between stored users and credential lookup. |
| Config | Add minimal auth config under `src/config` requiring JWT secret/TTL without logging secrets | Read ad-hoc env values in services | Keeps provider config centralized and avoids secret leakage. |

## Data Flow

```text
POST /auth/login -> AuthController -> AuthService
  -> normalize email -> Prisma user+role lookup -> Argon2 verify
  -> JwtService.sign({ sub: user.id }) -> accessToken

Bearer request -> JwtAuthGuard -> JwtStrategy
  -> Prisma active user reload -> request.user
  -> RolesGuard(@Roles ADMIN) -> UsersController -> UsersService
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Modify | Add JWT/passport dependencies and passport-jwt types. |
| `src/app.module.ts` | Modify | Register `AuthModule`. |
| `src/config/auth.config.ts` | Create | JWT secret/TTL loader with fail-fast missing-secret behavior. |
| `src/config/swagger.config.ts` | Modify | Add global Bearer auth scheme. |
| `src/modules/auth/*` | Create | Module, controller, service, DTOs, JWT strategy, unit/OpenAPI tests. |
| `src/common/guards/*` | Create | `JwtAuthGuard` and `RolesGuard`. |
| `src/common/decorators/*` | Create | `@Roles(...)` and `@CurrentUser()`. |
| `src/common/auth/authenticated-user.ts` | Create | Request user contract used by guards/decorators. |
| `src/common/utils/email-normalizer.ts` | Create | Shared email normalization. |
| `src/common/security/password-hasher.service.ts` | Modify | Add `verify(password, hash)`. |
| `src/modules/users/users.controller.ts` | Modify | Add Bearer docs, `JwtAuthGuard`, `RolesGuard`, `@Roles(UserRole.ADMIN)`, and explicit `401/403` responses. |
| `src/modules/users/users.service.ts` | Modify | Normalize emails before create/update persistence. |
| `src/modules/users/*.spec.ts`, `test/users.e2e-spec.ts` | Modify | Replace public-route expectations with auth/RBAC coverage. |

## Interfaces / Contracts

```ts
type LoginRequest = { email: string; password: string };
type LoginResponse = { accessToken: string; tokenType: 'Bearer' };
type AuthenticatedUser = { id: string; email: string; role: UserRole; isActive: true };
```

`POST /auth/login` returns `401` with the same response for inactive users, missing users, and wrong passwords. Users routes require Bearer auth and ADMIN role; valid non-ADMIN users receive `403`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Argon2 verify, uniform login rejection, token signing, active-user reload, roles checks, email normalization | Focused service/strategy/guard specs with Prisma/JWT mocks. |
| Integration/OpenAPI | Bearer scheme, auth DTOs, users operation security, 401/403 docs | Swagger document specs. |
| E2E | Login success/failure; users endpoints 401 without token, 403 non-ADMIN, 2xx ADMIN | Supertest with mocked Prisma/hasher and real Nest guards. |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh` | N/A: no executable-file classification | No file execution path | None |
| Git repository selection | `git -C`, relative paths, absolute paths | N/A: no VCS automation | No git command composition | None |
| Commit state | staged, `commit -a`, empty index | N/A: no commit automation | No commit behavior changed | None |
| Push state | tracking branch, first push, explicit refspec | N/A: no push automation | No push behavior changed | None |
| PR commands | explicit `--head`, environment prefix, composed commands | N/A: no PR automation | No PR command composition | None |

## Migration / Rollout

No schema migration required. Roll out as one chained PR slice after RED tests; configure JWT secret/TTL before runtime verification.

## Open Questions

- [ ] None.
