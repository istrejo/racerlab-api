# User Auth Specification

## Purpose

Define login and JWT access-token authentication for active internal users.

## Requirements

### Requirement: Active User Login

The system MUST accept `POST /auth/login` with email and password, normalize email comparisons consistently with user create/update flows where applicable, and issue a JWT access token only when the credentials belong to an active user. The response MUST NOT disclose whether rejection was caused by an unknown user, an inactive user, or a wrong password, and MUST NOT include refresh-token artifacts in this slice.

#### Scenario: Issue access token for an active user

- GIVEN an active user exists with a stored password hash and role
- WHEN the client submits valid credentials to `POST /auth/login`
- THEN the response returns success with a JWT access token only

#### Scenario: Normalize email identity consistently

- GIVEN a user email differs only by letter casing across login or user write inputs
- WHEN the system evaluates identity or uniqueness
- THEN it treats the normalized email value consistently

#### Scenario: Reject invalid or inactive credentials without leakage

- GIVEN the submitted email is unknown, inactive, or the password is wrong
- WHEN the client calls `POST /auth/login`
- THEN the response rejects the request without revealing which condition failed

### Requirement: Current User Revalidation

The system MUST validate protected JWTs against the current database record for the referenced user, and stale token claims MUST NOT grant access after deactivation or role change.

#### Scenario: Accept token for a current active user

- GIVEN a valid JWT references an active stored user
- WHEN the token is used on a protected endpoint
- THEN the request is authenticated as that current user

#### Scenario: Reject stale claims after user state changes

- GIVEN a valid JWT references a user who is now inactive or no longer allowed
- WHEN the token is used on a protected endpoint
- THEN the request is denied
