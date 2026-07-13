# Design: Complete Auth Session Cycle

## Technical Approach

Extend the existing NestJS `AuthModule` without moving auth workflows into Supabase clients. Access tokens remain 15-minute JWTs. Login creates a Prisma-backed refresh session, returns the access token body, and sets one opaque refresh token in an HttpOnly cookie. Refresh rotates the session transactionally, stores only token hashes, revalidates the live user, and revokes the token family on replay. Swagger remains the frontend contract source.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Opaque cookie refresh token | Needs cookie middleware and DB state, but enables hash-only storage and revocation. | Use HttpOnly cookie, never response body. |
| One row per rotated token | More rows than mutable sessions, but gives replay evidence and replacement linkage. | Create `AuthSession` rows per token with shared `tokenFamilyId`. |
| Raw SQL partial indexes | Prisma 6.19 schema cannot reliably model active-session partial indexes. | Use Prisma model plus migration SQL for active filters. |
| `/logout-all` with bearer auth | Requires valid access token, but uses existing guard and avoids treating refresh as broad auth. | Protect with `JwtAuthGuard`; `/logout` uses current refresh cookie. |

## Data Flow

```text
login -> AuthService validates user -> AuthSession(hash, family) -> Set-Cookie + access JWT
refresh(cookie) -> hash lookup -> tx consume old -> create replacement -> Set-Cookie + access JWT
replay(rotated/revoked hash) -> tx revoke family -> clear cookie -> 401 generic
logout(cookie) -> revoke current session if known -> clear cookie -> 204
logout-all(bearer) -> revoke all user sessions -> clear cookie -> 204
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Add `cookie-parser` runtime dependency and typings if needed. |
| `src/main.ts` | Modify | Register cookie parser before routes. |
| `src/config/auth.config.ts` | Modify | Add refresh TTL/cookie config: 30d TTL, name, secure, sameSite, optional domain. |
| `.env.example` | Modify | Document `JWT_ACCESS_TOKEN_TTL=15m` and refresh cookie/session variables. |
| `prisma/schema.prisma` | Modify | Add `User.authSessions` and `AuthSession` model. |
| `prisma/migrations/*` | Create | Create `auth_sessions`, FK, unique token hash, user/family/expiry indexes, and active partial indexes. |
| `src/modules/auth/*` | Modify/Create | Add refresh token helper/session logic, controller cookie endpoints, DTOs, Swagger docs. |
| `src/modules/auth/*.spec.ts`, `test/auth.e2e-spec.ts` | Modify | Add strict RED-GREEN tests for rotation, reuse, logout, cookies, and OpenAPI. |

## Interfaces / Contracts

```prisma
model AuthSession {
  id String @id @default(uuid()) @db.Uuid
  userId String @map("user_id") @db.Uuid
  tokenFamilyId String @map("token_family_id") @db.Uuid
  tokenHash String @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  consumedAt DateTime? @map("consumed_at")
  revokedAt DateTime? @map("revoked_at")
  replacedBySessionId String? @map("replaced_by_session_id") @db.Uuid
  createdUserAgent String? @map("created_user_agent")
  createdIp String? @map("created_ip")
  lastUsedUserAgent String? @map("last_used_user_agent")
  lastUsedIp String? @map("last_used_ip")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([tokenFamilyId])
  @@index([expiresAt])
  @@map("auth_sessions")
}
```

Endpoints: `POST /auth/refresh` returns `{ accessToken, tokenType }` and replacement cookie; `POST /auth/logout` returns `204`; `POST /auth/logout-all` returns `204` with bearer auth. All invalid refresh states return generic `401` except logout, which stays state-neutral and clears the cookie.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Hash-only token service, config parsing, transactional rotation, family revoke, metadata capture. | Strict TDD: write failing Jest specs before code. |
| E2E | Login cookie, refresh rotation, replay revocation, logout/logout-all, 15m JWT/30d cookie. | Supertest assertions on `Set-Cookie`, status, response body. |
| OpenAPI | Cookie-based refresh/logout contracts and bearer-only logout-all. | Existing Swagger document specs. |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification. | None. | None. |
| Git repository selection | N/A: no VCS automation. | None. | None. |
| Commit state | N/A: no commit automation. | None. | None. |
| Push state | N/A: no push automation. | None. | None. |
| PR commands | N/A: no PR command execution. | None. | None. |

## Migration / Rollout

Add a forward Prisma migration only; no backfill required. Existing access tokens remain valid until expiry. Deploy backend and OpenAPI together. Rollback reverts endpoints, cookie middleware, config additions, and session table migration if no production refresh sessions must be preserved.

## Open Questions

- [ ] Select chained PR strategy before `sdd-tasks`/`sdd-apply` because force-chained remains active.
