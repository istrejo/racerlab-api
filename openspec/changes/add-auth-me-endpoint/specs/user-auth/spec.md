# Delta for User Auth

## ADDED Requirements

### Requirement: Current Session Bootstrap

The system MUST provide bearer-protected `GET /api/auth/me` that returns the database-revalidated current user’s safe identity and expanded profile, current role, active-workshop context, and boolean `requiresPasswordChange`. The response contract MUST be documented in OpenAPI. It MUST NOT include granular permissions, password hashes, refresh tokens, access tokens, session secrets, or other sensitive authentication material.

#### Scenario: Return an active workshop-bound session

- GIVEN a bearer token belongs to a current active user with an active workshop membership
- WHEN the client calls `GET /api/auth/me`
- THEN it receives `200` with safe identity/profile, current role, active-workshop context, and `requiresPasswordChange`

#### Scenario: Return a neutral session

- GIVEN a bearer token belongs to a current active user whose session has no active membership
- WHEN the client calls `GET /api/auth/me`
- THEN it receives `200` with an empty active-workshop context and the current identity and password-change state

#### Scenario: Report forced password change

- GIVEN a bearer token belongs to a current user requiring a password change
- WHEN the client calls `GET /api/auth/me`
- THEN it receives `200` with `requiresPasswordChange` set to `true`
- AND the endpoint remains available solely to report the current state

#### Scenario: Reject an unauthenticated request

- GIVEN no valid bearer token is supplied
- WHEN the client calls `GET /api/auth/me`
- THEN the request is rejected as unauthenticated

#### Scenario: Reject stale or invalid session state

- GIVEN the bearer token references a revoked session, inactive user or membership, or stale workshop or role context
- WHEN the client calls `GET /api/auth/me`
- THEN the request is denied according to current-session revalidation

#### Scenario: Exclude sensitive data

- GIVEN an authenticated client calls `GET /api/auth/me`
- WHEN the response is serialized
- THEN it contains no credential hashes, tokens, session secrets, or granular permissions

## MODIFIED Requirements

### Requirement: Mandatory First-Access Password Change

Users created manually MUST be marked as requiring a password change. Login and refresh MUST expose that state, and protected requests MUST resolve it from the current user row rather than trusting a JWT claim. Every private endpoint except password change, logout-all, and `GET /api/auth/me` MUST respond with `403 PASSWORD_CHANGE_REQUIRED` while the flag is active. `GET /api/auth/me` MUST only report the revalidated bootstrap state and MUST NOT bypass the password-change requirement for other private resources.

(Previously: Only password change and logout-all were exempt from the forced-password restriction.)

#### Scenario: Block a temporary-password user

- GIVEN a manually created user logs in with the administrator-issued password
- WHEN the user calls a private business endpoint
- THEN access is denied with `PASSWORD_CHANGE_REQUIRED`

#### Scenario: Replace the temporary password

- GIVEN an authenticated user is required to change their password
- WHEN `POST /auth/change-password` receives the valid current password and a different valid new password
- THEN only the Argon2 hash is stored, the requirement is cleared, every other session is revoked, and the current session may access private resources

#### Scenario: Reject password reuse

- GIVEN an authenticated user submits the current password as the new password
- WHEN the password-change endpoint validates the request
- THEN the change is rejected and the existing credential remains unchanged
