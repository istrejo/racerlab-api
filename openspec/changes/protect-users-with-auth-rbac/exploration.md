## Exploration: protect-users-with-auth-rbac

### Current State
`UsersModule` already exposes `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id`, and all four routes are currently public. `UsersService` persists hashed passwords through `src/common/security/password-hasher.service.ts`, maps `roles.name` to the `UserRole` enum, and returns sanitized DTOs, but there is no `AuthModule`, no JWT strategy, no guards/decorators under `src/common`, and Swagger only publishes the API without a Bearer scheme. Prisma already has `User`, `Role`, `Permission`, `RolePermission`, and `isActive`, while `prisma/seed.ts` only bootstraps roles. Current OpenAPI and e2e coverage explicitly assert these users endpoints are unauthenticated, so this change must replace bootstrap-only assumptions instead of layering on top of them.

### Affected Areas
- `package.json` — missing auth dependencies such as `@nestjs/jwt`, `@nestjs/passport`, `passport`, and `passport-jwt`; `@nestjs/config` is also absent if config centralization is desired.
- `src/app.module.ts` — must register a new `AuthModule`.
- `src/modules/auth/*` — new module/controller/service/DTO/strategy surface for login and access-token issuance.
- `src/common/security/password-hasher.service.ts` — currently supports `hash()` only; auth needs password `verify()` too.
- `src/common/guards/*` — new `JwtAuthGuard` and `RolesGuard` belong in the shared NestJS boundary.
- `src/common/decorators/*` — new `@CurrentUser()` and `@Roles(...)` decorators belong here.
- `src/modules/users/users.controller.ts` — must add auth/role decorators and replace bootstrap-only Swagger wording with Bearer-protected documentation.
- `src/modules/users/users.openapi.spec.ts` — currently asserts `operation.security` is undefined; it must be updated to Bearer expectations.
- `test/users.e2e-spec.ts` — currently exercises all users routes anonymously; it must send JWTs and add `401/403` coverage.
- `src/modules/users/users.service.ts` or `src/modules/auth/*` — auth needs a narrow lookup path by email/id with role and `isActive`, without coupling to controller DTOs.
- `src/config/swagger.config.ts` — must add Bearer auth to the shared Swagger document builder.
- `prisma/schema.prisma`, `prisma/seed.ts` — no schema or migration is needed for slice one; the existing permissions tables stay out of scope.

### Approaches
1. **Full session auth in the first slice** — Implement login, access token, refresh token, logout/rotation concerns, guards/decorators, and users-route protection together.
   - Pros: Reaches the fuller TRD auth target earlier and reduces follow-up auth gaps.
   - Cons: Expands scope into refresh lifecycle design, token rotation/invalidation, more DTOs/tests, and higher risk of breaking the 800-line chained review budget.
   - Effort: High

2. **Access-token first, refresh second** — Implement login, Argon2 verify, JWT access token, JWT strategy/guards/decorators, protect users routes, and Swagger auth now; defer refresh/logout/me to a follow-up slice.
   - Pros: Matches the maintainer’s requested order, closes the immediate users security hole, and keeps the first slice reviewable.
   - Cons: Session longevity remains incomplete until the second auth slice lands.
   - Effort: Medium

### Recommendation
Use **Access-token first, refresh second**.

Recommended shape for the first slice:
- Add `POST /auth/login` with `email` + `password`; do not add `passport-local` yet because a plain controller + service flow is enough for slice one.
- Use `AuthService` + `JwtService` to issue an access token only.
- Make `JwtStrategy` load the current user from Prisma on each request (`id`, `role`, `isActive`) instead of trusting only token claims, so deactivation and role changes take effect immediately on protected routes.
- Make `RolesGuard` enforce `UserRole` enum checks only; do **not** implement permissions-table RBAC in this slice even though `Permission` and `RolePermission` already exist.
- Protect `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id` with `JwtAuthGuard` and `@Roles(...)`.
- Default the route policy to **ADMIN-only** for all four users endpoints unless the maintainer explicitly wants `MANAGER` read access; the PRD only states that administrators configure users.
- Add Swagger Bearer configuration globally and mark protected users endpoints with `@ApiBearerAuth()`.

Refresh tokens should be a **later slice**, not part of the first one. They belong with token lifetime policy, rotation/invalidation, and probably `refresh/logout/me`, which is a separate reviewable unit from “stop shipping public users endpoints”.

### Risks
- The repo has no explicit route-role matrix yet beyond the PRD note that administrators configure users, so authorization policy must be frozen in proposal/design before apply.
- Existing users e2e/OpenAPI tests are intentionally built around unauthenticated bootstrap behavior and will need coordinated replacement.
- `PasswordHasherService` lacks `verify()`, which is a direct login blocker today.
- Email normalization is absent in the current users flow, so login and creation can diverge on casing unless the auth slice normalizes consistently.
- JWT secret/TTL configuration is not wired yet; a rushed implementation could introduce ad-hoc env handling.
- If JWT validation trusts only token claims, user deactivation and role edits remain stale until token expiry.

### Ready for Proposal
Yes — the orchestrator should tell the user the proposal is ready if it locks an ADMIN-first authorization matrix, keeps refresh/logout/me out of slice one, and reserves a second chained slice for refresh-token lifecycle work.
