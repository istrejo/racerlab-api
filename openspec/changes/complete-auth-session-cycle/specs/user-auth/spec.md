# Delta for user-auth

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Active User Login

The system MUST accept `POST /auth/login` with email and password, normalize email comparisons consistently with user create/update flows where applicable, and issue a 15-minute JWT access token plus a refresh token only via HttpOnly cookie when the credentials belong to an active user. The response MUST NOT disclose whether rejection was caused by an unknown user, an inactive user, or a wrong password, and MUST NOT expose the refresh token in the response body.
(Previously: Login returned only a JWT access token and excluded refresh-token artifacts.)

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
