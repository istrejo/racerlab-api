# Design: Add Auth Me Endpoint

## Technical Approach

Add `GET /api/auth/me` to the existing `AuthController`. The route uses `JwtAuthGuard`, so `JwtStrategy` first validates the bearer token and revalidates the access session, user, membership, workshop, and live role context. `@AllowPasswordChangeRequired()` exempts only this handler from the guard's forced-password rejection; it does not change access to any other route.

`AuthService.getMe()` will perform a narrow Prisma read keyed by the guarded `user.id` and `user.sessionId`, select only response fields, reject missing/inactive context as unauthorized, and map neutral sessions to `activeWorkshop: null`. A dedicated Swagger DTO defines the serialization allowlist.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Return `AuthenticatedUser` directly | Avoids a query but lacks profile data and risks coupling the API to guard internals | Reject; use a response DTO and explicit Prisma `select` |
| Put workshop profile, role, and workshop identity in one nullable context | Makes neutral-session semantics unambiguous and avoids nullable workshop-only fields | Choose `activeWorkshop: null` for neutral sessions |
| Add `/me` to the existing forced-password metadata exception | Reuses centralized guard behavior while keeping every other private route blocked | Choose handler-level `@AllowPasswordChangeRequired()` only |
| Return permissions or alter persistence | Expands scope and exposure without serving shell bootstrap | Reject; role only and no schema change |

## Data Flow

```text
Bearer request -> JwtAuthGuard -> JwtStrategy session/user/context revalidation
                                      |
                                      v
AuthController.me(CurrentUser) -> AuthService.getMe -> Prisma allowlisted read
                                      |
                                      v
                                  MeResponseDto
```

The service response allowlist is:

- `user`: `id`, `name`, `email`.
- `activeWorkshop`: either `null`, or `workshopId`, `membershipId`, workshop `name`, live `role`, and `profile` containing membership `displayName`, `phone`, and `address`.
- `requiresPasswordChange`: mapped from live `User.mustChangePassword`.

The query and mapper never expose `passwordHash`, token/session identifiers or metadata, permissions, activation internals, or timestamps.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/modules/auth/dto/me-response.dto.ts` | Create | Define nested Swagger DTOs and the safe response allowlist, including nullable active-workshop context. |
| `src/modules/auth/auth.controller.ts` | Modify | Add bearer-documented `GET /auth/me`, `JwtAuthGuard`, the forced-password exception, and DTO response/error annotations. |
| `src/modules/auth/auth.service.ts` | Modify | Add the allowlisted current-session query, active/neutral mapping, and unauthorized handling for stale state. |
| `src/modules/auth/auth.service.spec.ts` | Modify | Unit-test selected fields, active and neutral mappings, stale-state denial, and sensitive-field exclusion. |
| `src/modules/auth/auth.openapi.spec.ts` | Modify | Assert bearer security, responses, nullability, required fields, role enum, and the exact DTO property allowlist. |
| `test/auth.e2e-spec.ts` | Modify | Cover active, neutral, forced-password, unauthenticated, stale-session/context, and no-sensitive-data behavior. |

## Interfaces / Contracts

`GET /api/auth/me` returns `200 MeResponseDto`. `activeWorkshop` is `null` for a valid neutral session; otherwise it contains the live membership profile, role, and workshop identity. Missing/invalid bearer credentials or stale/revoked/inactive session context follow existing `JwtStrategy` unauthorized behavior. Dependency failures retain the existing authentication `503` behavior. No token or refresh cookie is issued or rotated.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Query allowlist, mapping, null context, stale state | Extend mocked-Prisma `AuthService` tests with exact query and response assertions. |
| Contract | OpenAPI route and safe schema | Extend `auth.openapi.spec.ts` and assert exact properties/security/responses. |
| E2E | Guard interaction and product scenarios | Exercise `/api/auth/me` with active, neutral, forced-password, absent, and invalidated sessions; prove another private route remains `403` during forced-password state. |

## Threat Matrix

N/A — this is an HTTP controller route only; it introduces no documentation-path execution, shell/subprocess, repository, commit, push, PR automation, executable classification, or process-integration boundary.

## Migration / Rollout

No migration is required. Deliver API-1 (route, DTO, service, unit/contract tests) first, then stack API-2 (E2E and SDD evidence) on `feat/auth-me`. Each slice stays independently reviewable and rollback removes no persisted data.

## Open Questions

None.
