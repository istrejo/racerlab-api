# Proposal: Add Auth Me Endpoint

## Intent

Close the frontend-shell bootstrap gap with an authenticated `GET /api/auth/me` that returns the current, database-revalidated identity, profile, role, session context, and forced-password state.

## Scope

### In Scope
- Add bearer-protected `GET /api/auth/me` under the existing auth API.
- Return identity, non-sensitive profile data, current role, active-workshop context, and an explicit `requiresPasswordChange` boolean.
- Return `200` with an empty active-workshop context when the session is neutral, so the frontend can prompt for workshop selection.
- Document the response and auth/error contract in Swagger/OpenAPI.

### Out of Scope
- Granular permission payloads or permission evaluation changes; this slice exposes role only.
- Customer/vehicle intake and all other operational APIs.
- Schema migrations or changes to login, refresh, workshop-selection, or password-change behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `user-auth`: add a current-session bootstrap endpoint with live identity, profile, password-change, role, and workshop context.

## Approach

Use the existing `JwtAuthGuard` and current-session revalidation. Explicitly allow this bootstrap route during forced-password state so it can report that state. Add a dedicated response DTO and an `AuthService` query that selects only safe user/profile and active-membership/workshop fields. Preserve neutral sessions by serializing no active workshop rather than rejecting them.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/auth/auth.controller.ts` | Modified | Add `GET /auth/me` and Swagger annotations. |
| `src/modules/auth/auth.service.ts` | Modified | Load and map current bootstrap context. |
| `src/modules/auth/dto/` | New | Define safe me-response contract. |
| `src/modules/auth/auth.openapi.spec.ts` | Modified | Assert OpenAPI contract. |
| `test/auth.e2e-spec.ts` | Modified | Cover active and neutral sessions. |
| `openspec/specs/user-auth/spec.md` | Modified | Add endpoint requirement after delta approval. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sensitive fields leak | Low | DTO allowlist; no hashes, tokens, or permissions. |
| Stale context is returned | Low | Reuse guarded, database-revalidated session context. |

## Rollback Plan

Remove the route, DTO, service mapping, and contract tests; no persisted data or migration rollback is required.

## Dependencies

- Existing auth/session, membership, role, and workshop context foundation.

## Success Criteria

- [x] An authenticated client receives the defined safe identity/profile, role, active-workshop context, and forced-password boolean.
- [x] A neutral session receives `200` with empty active-workshop context.
- [x] Swagger/OpenAPI and focused tests cover success and authentication behavior.
