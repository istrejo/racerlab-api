# User Auth Specification

## Purpose

Define login and JWT access-token authentication for global users with live workshop membership context.

## Requirements

### Requirement: Active User Login

The system MUST accept `POST /auth/login` with email and password, normalize email comparisons consistently with user create/update flows where applicable, and issue a 15-minute JWT access token plus a refresh token only via HttpOnly cookie when the credentials belong to an active user. The response MUST NOT disclose whether rejection was caused by an unknown user, an inactive user, or a wrong password, and MUST NOT expose the refresh token in the response body.

#### Scenario: Issue access token and refresh cookie for an active user

- GIVEN an active user exists with a stored password hash and role
- WHEN the client submits valid credentials to `POST /auth/login`
- THEN the response returns success with a JWT access token and HttpOnly refresh cookie

#### Scenario: Normalize email identity consistently

- GIVEN a user email differs only by letter casing across login or user write inputs
- WHEN the system evaluates identity or uniqueness
- THEN it treats the normalized email value consistently

#### Scenario: Reject invalid or inactive credentials without leakage

- GIVEN the submitted email is unknown, inactive, or the password is wrong
- WHEN the client calls `POST /auth/login`
- THEN the response rejects the request without revealing which condition failed

### Requirement: Current User Revalidation

The system MUST validate protected JWTs against the current auth session, global user, and active membership. Workshop and role authority MUST be loaded from current database state, and stale claims MUST NOT grant access after session, user, membership, workshop, or role changes.

#### Scenario: Accept token for a current active user

- GIVEN a valid JWT references an active stored user
- WHEN the token is used on a protected endpoint
- THEN the request is authenticated as that current user and current membership

#### Scenario: Reject stale claims after user state changes

- GIVEN a valid JWT references a revoked session, inactive user, inactive membership, or stale workshop context
- WHEN the token is used on a protected endpoint
- THEN the request is denied

### Requirement: Mandatory First-Access Password Change

Users created manually MUST be marked as requiring a password change. Login and refresh MUST expose that state, and protected requests MUST resolve it from the current user row rather than trusting a JWT claim. Every private endpoint except password change and logout-all MUST respond with `403 PASSWORD_CHANGE_REQUIRED` while the flag is active.

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

### Requirement: Workshop Selection

The system MUST bind each auth session to zero or one active membership. Login MUST select the membership automatically only when exactly one is active; otherwise the session remains neutral until `POST /auth/select-workshop` validates and stores a membership owned by the user.

#### Scenario: Invalidate stale context after selection

- GIVEN a neutral or workshop-bound session has an access token
- WHEN its active membership changes
- THEN a replacement access token is issued and the previous context no longer authenticates

### Requirement: Refresh Session Rotation

The system MUST accept `POST /auth/refresh` only with a valid HttpOnly refresh cookie. It MUST revalidate the current user, issue a new 15-minute JWT access token, rotate the refresh cookie, and extend refresh validity up to 30 days while the user remains active. Raw refresh token values MUST be non-recoverable from storage. Multiple concurrent refresh sessions for one active user MUST be allowed, MUST rotate independently, and MUST retain lightweight user-agent and IP metadata for session creation, refresh, and security revocation.

#### Scenario: Rotate an active refresh session

- GIVEN an active user has a valid refresh cookie
- WHEN the client calls `POST /auth/refresh`
- THEN the response returns a new access token and replacement refresh cookie

#### Scenario: Reject invalid refresh state generically

- GIVEN the refresh cookie is missing, expired, revoked, unknown, or belongs to a user who is no longer allowed
- WHEN the client calls `POST /auth/refresh`
- THEN the response is unauthenticated without revealing the failure reason

#### Scenario: Reuse detection revokes the affected family

- GIVEN a rotated or revoked refresh token is presented again
- WHEN the client calls `POST /auth/refresh`
- THEN the response is unauthenticated and that token family is no longer refreshable

#### Scenario: Concurrent sessions stay independent

- GIVEN the same active user has sessions from different user-agent or IP contexts
- WHEN one session refreshes
- THEN other active sessions remain usable and the session event keeps lightweight context metadata

### Requirement: Session Revocation Endpoints

The system MUST provide `POST /auth/logout` to revoke only the current refresh session and `POST /auth/logout-all` to revoke every active refresh session for the authenticated user. Revoked sessions MUST NOT mint new access tokens. Other sessions MUST remain usable unless broader revocation applies. Responses MUST NOT reveal extra session state.

#### Scenario: Logout revokes only the current session

- GIVEN a user has multiple active refresh sessions
- WHEN the current session calls `POST /auth/logout`
- THEN that session can no longer refresh and sibling sessions remain usable

#### Scenario: Logout-all revokes every active session

- GIVEN a user has multiple active refresh sessions
- WHEN the authenticated user calls `POST /auth/logout-all`
- THEN every active refresh session for that user becomes non-refreshable
