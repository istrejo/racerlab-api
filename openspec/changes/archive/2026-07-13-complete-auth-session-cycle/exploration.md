## Exploration: complete-auth-session-cycle

### Current State
`AppModule` already loads `AuthModule`, and the current auth slice is intentionally access-token-only. `AuthController` exposes public `POST /auth/login`, `AuthService` normalizes email, resolves duplicate-safe user identity from Prisma, verifies Argon2 hashes, rejects inactive users with the same `401` as bad credentials, and signs a JWT access token with `{ sub: user.id }` only. `JwtStrategy` reloads the current user and role from Prisma on every protected request, so users-route authorization already depends on live database state rather than stale token claims. Swagger already publishes a Bearer scheme for protected routes, and the main `user-auth` OpenSpec spec explicitly says refresh-token artifacts are out of scope for the current archived slice.

There is currently NO refresh-token/session persistence. `src/config/auth.config.ts` only defines `JWT_SECRET` and `JWT_ACCESS_TOKEN_TTL`. `prisma/schema.prisma` has `User`, `Role`, and related domain models, but no auth-session, refresh-token, token-family, revoke, or audit metadata table/columns. The repo also has no `/auth/refresh`, `/auth/logout`, `/auth/me`, cookie handling, or refresh-token Swagger/test coverage.

### Affected Areas
- `src/modules/auth/auth.controller.ts` — login docs explicitly say refresh is out of scope; refresh/logout endpoints would be added here.
- `src/modules/auth/auth.service.ts` — current service only issues access tokens and has no session persistence, rotation, or revoke logic.
- `src/modules/auth/dto/login-response.dto.ts` — current response is access-token-only; response/transport contracts will expand or change depending on refresh delivery.
- `src/config/auth.config.ts` — missing refresh-secret/TTL/session-lifetime configuration.
- `prisma/schema.prisma` — missing an auth-session model for hashed refresh tokens, family tracking, expiry, and revocation state.
- `prisma/migrations/*` — a new migration is required because the current schema has no refresh-session storage.
- `src/modules/auth/auth.openapi.spec.ts` and `test/auth.e2e-spec.ts` — current contract/tests assert access-token-only login and no `refreshToken` field.
- `openspec/specs/user-auth/spec.md` — current source-of-truth spec stops at login + access-token revalidation and must be extended.

### Approaches
1. **Opaque refresh sessions with hashed persistence** — keep JWT for access tokens, but issue a high-entropy opaque refresh token whose hash is stored in Prisma with session/family metadata.
   - Pros: Best fit for revocation and reuse detection; the server never stores raw refresh tokens; avoids trusting refresh JWT claims; simpler to invalidate one session or an entire token family.
   - Cons: Requires a new session table, transactional rotation logic, and an explicit transport choice (cookie vs body/header).
   - Effort: Medium

2. **JWT refresh tokens plus DB-backed rotation metadata** — sign refresh tokens too, but still persist hashed token identifiers/session family state for rotation and reuse detection.
   - Pros: Reuses current JWT tooling and can carry self-describing claims.
   - Cons: Still needs database state for secure rotation/logout, increases secret/claim complexity, and risks future drift if refresh JWT claims are treated as authoritative.
   - Effort: High

### Recommendation
Use **Opaque refresh sessions with hashed persistence** as a NEW OpenSpec change named `complete-auth-session-cycle`, not as a continuation inside the archived `protect-users-with-auth-rbac` folder.

Why:
- The archived auth/RBAC change deliberately froze an access-token-only boundary in exploration, proposal, design, spec, tests, and verify artifacts.
- OpenSpec archive folders are an immutable audit trail, so this work should follow as the second auth slice through a fresh change.
- Opaque refresh tokens align better with the missing persistence needs here: one-time rotation, logout, family revocation, and reuse detection all depend on server-side session state anyway.

Safe design constraints for the proposal/design phase:
- Keep access tokens short-lived JWTs for resource authorization; do NOT use refresh tokens to authorize business endpoints.
- Store only a HASH of each refresh token in the database, never the raw token.
- Model each refresh session with at least: `id/jti`, `userId`, `tokenFamilyId`, `tokenHash`, `expiresAt`, `revokedAt`, `rotatedAt/usedAt`, and replacement linkage or equivalent rotation state.
- Perform refresh rotation transactionally: validate current session + user state, revoke/consume the old refresh token, create the replacement session/token, then issue the new access token.
- Treat reuse of an already-rotated/revoked refresh token as a security event: revoke the whole token family and force re-authentication.
- Logout MUST be server-side revocation, not only client-side token deletion.
- Refresh/logout flows MUST re-check current user activity before issuing new access tokens.
- Swagger/OpenAPI MUST keep Bearer auth for protected resources only; refresh transport must be documented separately based on the chosen contract.

### Risks
- The biggest unresolved design fork is refresh-token transport: HttpOnly cookie vs response body/header. That choice affects Swagger, frontend integration, CSRF posture, and whether extra middleware/dependencies are needed.
- Session cardinality is undefined: single-session, multi-device sessions, and logout-all semantics each produce different schema/index/revocation rules.
- Reuse detection without careful transactional design can create race conditions that either miss token theft or falsely revoke active sessions.
- Adding session persistence changes the database contract for the first time in auth, so migration, indexes, and cleanup/expiry strategy must be reviewed carefully.

### Ready for Proposal
No — proposal should wait until these assumptions are explicitly locked: refresh transport contract, whether multiple concurrent sessions are allowed, whether `/auth/logout-all` or `/auth/me` belong in this slice, the refresh absolute/inactivity TTL policy, and whether audit metadata such as user-agent/IP must be persisted for session events.
