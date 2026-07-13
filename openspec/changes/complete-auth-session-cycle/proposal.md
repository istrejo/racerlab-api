# Proposal: Complete Auth Session Cycle

## Intent

Add secure refresh-session management so internal users stay signed in across active workshop devices without weakening revocation, reuse detection, or live-user validation.

## Scope

### In Scope
- Opaque refresh tokens in HttpOnly cookies with hashed storage only.
- Multi-session persistence, token-family rotation, reuse detection, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`.
- 15m access TTL, 30d rolling refresh TTL, lightweight session metadata, and Swagger/OpenAPI updates.

### Out of Scope
- `GET /auth/me`, frontend UX changes, device naming, and session-management UI.
- Heavy audit/event reporting, geo/device fingerprinting, and non-auth business endpoint changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `user-auth`: extend login-only auth to cover refresh-session lifecycle, session revocation, cookie transport, and documented auth contracts.

## Approach

Keep access tokens as short-lived JWTs. Add a Prisma-backed auth-session store for per-device refresh sessions with token family linkage, hashed token values, expiry, revoke/consume timestamps, and user-agent/IP metadata. Refresh rotation MUST be transactional: validate session + user, consume old token, mint replacement, revoke family on reuse, and issue a new access token plus renewed cookie.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/specs/user-auth/spec.md` | Modified | Add refresh/logout/session requirements |
| `src/modules/auth/` | Modified | Controller/service contracts will expand in later phases |
| `src/config/auth.config.ts` | Modified | Add refresh/session TTL config |
| `prisma/schema.prisma` | Modified | Add auth-session persistence model |
| `src/modules/auth/auth.openapi.spec.ts` | Modified | Document cookie-based refresh/logout flows |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rotation race/reuse false positives | Med | Transactional consume-and-replace with family revocation rules |
| Cookie transport adds CSRF/integration constraints | Med | Keep refresh cookie scoped/HttpOnly and specify contract clearly |

## Rollback Plan

Revert auth-session schema/API changes, remove refresh endpoints and cookie issuance, and restore access-token-only login behavior from `user-auth` if verification or security review fails.

## Dependencies

- Prisma migration for auth-session storage and indexes.
- NestJS cookie handling plus Swagger contract updates.

## Success Criteria

- [ ] Specs define secure multi-session refresh, logout, rotation, and reuse-detection behavior for `user-auth`.
- [ ] Design/implementation can revoke one session or all sessions without storing raw refresh tokens.
