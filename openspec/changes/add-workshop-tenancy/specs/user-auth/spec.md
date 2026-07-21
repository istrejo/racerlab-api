# Delta for User Auth

## ADDED Requirements

### Requirement: Workshop Registration Onboarding

The system MUST provide `POST /auth/register-workshop` to atomically create a global user, one workshop, one active `OWNER` membership, one membership-bound auth session, one scoped access token, and one refresh cookie. Any conflict involving existing email, existing owned workshop, or ownership or membership integrity MUST return `409`, MUST roll back the whole flow, and MUST be documented in OpenAPI as a conflict outcome.

#### Scenario: Register workshop atomically

- GIVEN the submitted email and workshop ownership are available
- WHEN `POST /auth/register-workshop` succeeds
- THEN the response authenticates the new owner and all required records exist together

#### Scenario: Reject and roll back conflicting registration

- GIVEN the email already exists or the caller would violate workshop ownership invariants
- WHEN `POST /auth/register-workshop` is submitted
- THEN the response is `409` and no partial tenancy or session records persist

### Requirement: Workshop Selection and Switching

The system MUST distinguish public `POST /auth/select-workshop` from authenticated `POST /auth/switch-workshop`. Selection MUST exchange a temporary restricted token from multi-membership login for membership-bound access and refresh credentials exactly once. Restricted selection tokens MUST be unusable on protected APIs, `POST /auth/refresh`, `POST /auth/logout-all`, or `POST /auth/switch-workshop`. Switching MUST require an already authenticated membership, verify the target active membership, consume the current refresh session atomically, create a same-family replacement bound to the target membership, and mint a target-scoped access token. The pre-switch access token MUST remain valid only for its original workshop until expiry.

#### Scenario: Complete multi-membership login

- GIVEN login returns a restricted selection token and selectable workshops
- WHEN the caller posts a valid workshop choice to `POST /auth/select-workshop`
- THEN one membership-bound access token and refresh cookie are issued for the chosen workshop

#### Scenario: Reject invalid selection or switch

- GIVEN the token is expired, reused, used outside selection, or the target membership is inactive or absent
- WHEN select or switch is attempted
- THEN the request is rejected

## MODIFIED Requirements

### Requirement: Active User Login

The system MUST accept `POST /auth/login` with email and password, normalize email comparisons consistently with user create or update flows where applicable, and authenticate only an active global user with at least one active membership. If exactly one active membership exists, the response MUST issue a 15-minute workshop-scoped JWT access token plus a refresh token only via HttpOnly cookie for that membership. If multiple active memberships exist, the response MUST return a temporary restricted selection token plus the selectable workshops, MUST NOT issue a refresh cookie, and MUST NOT expose a workshop-scoped access token before `POST /auth/select-workshop`. The response MUST NOT disclose whether rejection was caused by an unknown user, an inactive user, no active memberships, or a wrong password, and MUST NOT expose refresh tokens in the response body.
(Previously: login always issued an access token and refresh cookie for any active user record.)

#### Scenario: Issue scoped credentials for a single active membership

- GIVEN an active user has exactly one active membership
- WHEN the client submits valid credentials to `POST /auth/login`
- THEN the response returns a workshop-scoped access token and HttpOnly refresh cookie

#### Scenario: Normalize email identity consistently

- GIVEN a user email differs only by letter casing across login or user write inputs
- WHEN the system evaluates identity or uniqueness
- THEN it treats the normalized email value consistently

#### Scenario: Require workshop selection for multi-membership login

- GIVEN an active user has multiple active memberships
- WHEN the client submits valid credentials to `POST /auth/login`
- THEN the response returns only the restricted selection token and workshop choices

#### Scenario: Reject invalid or inactive credentials without leakage

- GIVEN the submitted email is unknown, inactive, has no active memberships, or the password is wrong
- WHEN the client calls `POST /auth/login`
- THEN the response rejects the request without revealing which condition failed

### Requirement: Current User Revalidation

The system MUST validate protected JWTs against the current database record for the referenced user and the bound membership. Stale token claims MUST NOT grant access after user deactivation, membership deactivation or revocation, workshop mismatch, or persisted `AuthSession.userId` and `membershipId` inconsistency.
(Previously: validated only the current user record.)

#### Scenario: Accept token for a current active membership

- GIVEN a valid JWT references an active stored user and active stored membership for the same workshop
- WHEN the token is used on a protected endpoint
- THEN the request is authenticated as that current membership context

#### Scenario: Reject stale claims after user or membership changes

- GIVEN a valid JWT references a user or membership that is now inactive, revoked, mismatched, or workshop-inconsistent
- WHEN the token is used on a protected endpoint
- THEN the request is denied

### Requirement: Refresh Session Rotation

The system MUST accept `POST /auth/refresh` only with a valid HttpOnly refresh cookie bound to an active membership. It MUST revalidate the current user, the membership, the workshop context, and `AuthSession` integrity; issue a new 15-minute JWT access token for the same membership; rotate the refresh cookie; and extend refresh validity up to 30 days while the user and membership remain active. Raw refresh token values MUST be non-recoverable from storage. Multiple concurrent refresh sessions for one active user MAY exist across different memberships, MUST rotate independently, and MUST retain lightweight user-agent and IP metadata. Reuse or integrity mismatch MUST revoke the affected token family.
(Previously: refresh revalidated only the user and treated sessions as user-bound.)

#### Scenario: Rotate an active membership-bound refresh session

- GIVEN an active user has a valid refresh cookie for an active membership
- WHEN the client calls `POST /auth/refresh`
- THEN the response returns a new access token and replacement refresh cookie for that same membership

#### Scenario: Reject invalid refresh state generically

- GIVEN the refresh cookie is missing, expired, revoked, unknown, or belongs to an inactive or mismatched membership
- WHEN the client calls `POST /auth/refresh`
- THEN the response is unauthenticated without revealing the failure reason

#### Scenario: Reuse detection revokes the affected family

- GIVEN a rotated, revoked, or membership-mismatched refresh token is presented again
- WHEN the client calls `POST /auth/refresh`
- THEN the response is unauthenticated and that token family is no longer refreshable

#### Scenario: Concurrent sessions stay independent

- GIVEN the same active user has sessions in different user-agent, IP, or workshop contexts
- WHEN one session refreshes
- THEN other active sessions remain usable and keep their own metadata

### Requirement: Session Revocation Endpoints

The system MUST provide `POST /auth/logout` to revoke only the current membership-bound refresh session and `POST /auth/logout-all` to revoke every active refresh session for the authenticated user across memberships. Revoked sessions MUST NOT mint new access tokens. Other sessions MUST remain usable unless broader revocation applies. Responses MUST NOT reveal extra session state.
(Previously: logout-all only described user-bound refresh sessions without membership context.)

#### Scenario: Logout revokes only the current session

- GIVEN a user has multiple active refresh sessions
- WHEN the current session calls `POST /auth/logout`
- THEN that session can no longer refresh and sibling sessions remain usable

#### Scenario: Logout-all revokes every active session

- GIVEN a user has multiple active refresh sessions across one or more workshops
- WHEN the authenticated user calls `POST /auth/logout-all`
- THEN every active refresh session for that user becomes non-refreshable
