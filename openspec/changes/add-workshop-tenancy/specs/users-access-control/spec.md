# Delta for Users Access Control

## ADDED Requirements

### Requirement: Membership-Scoped Authorization Catalog

The system MUST authorize protected routes from the active membership's role and permission catalog, not from `User.roleId`. `User` remains identity-only. Only an active workshop `OWNER` MAY create employees or issue employee invitations. `OWNER` MUST NOT be assignable, invited, demoted, transferred, or replaced through user-management or invitation endpoints in this slice.

#### Scenario: Allow owner-managed employee administration

- GIVEN the caller holds the active `OWNER` membership for the workshop
- WHEN the caller creates or invites a non-`OWNER` employee membership
- THEN the operation is authorized

#### Scenario: Block owner-only actions from non-owners or owner mutations

- GIVEN the caller is not the active workshop owner or tries to create, invite, or update `OWNER`
- WHEN the admin request is evaluated
- THEN the request is denied

### Requirement: Membership-Active Isolation Enforcement

All protected business routes MUST require one active membership context. Inactive, revoked, unselected, or workshop-mismatched memberships MUST be denied even when the global user is active. Direct cross-workshop ID access attempts against customers, vehicles, service-orders, diagnoses, quotes, inventory, repair-tasks, evidences, comments, or reports MUST be denied.

#### Scenario: Allow same-workshop access with an active membership

- GIVEN the caller has an active membership in the workshop that owns the requested resource
- WHEN the caller uses a protected route allowed by that membership
- THEN the request is authorized

#### Scenario: Deny inactive or cross-workshop access

- GIVEN the caller's membership is inactive, revoked, unselected, or from another workshop
- WHEN the caller targets a protected business resource
- THEN the request is denied

## MODIFIED Requirements

### Requirement: ADMIN-Only Users Endpoints

The system MUST require a valid membership-bound JWT for `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id`. In this slice, only the active `OWNER` membership for the current workshop MUST be authorized. `GET /users` MUST list only users who share that workshop; `GET /users/:id` and `PATCH /users/:id` MUST reject cross-workshop targets; and user-management endpoints MUST NOT change workshop ownership.
(Previously: only a global `ADMIN` user using `User.roleId` could access all users endpoints.)

#### Scenario: Allow an authenticated owner request

- GIVEN the caller is authenticated with an active `OWNER` membership for the current workshop
- WHEN the caller accesses any users endpoint for that workshop
- THEN the request is authorized

#### Scenario: Block anonymous, non-owner, inactive, or cross-workshop access

- GIVEN the caller is anonymous, non-owner, inactive, or targets a user outside the active workshop
- WHEN the caller accesses any users endpoint
- THEN the request is denied

### Requirement: Swagger Bearer Contract

The system MUST publish Swagger or OpenAPI with Bearer authentication for protected users and workshop-administration endpoints. It MUST document `POST /auth/register-workshop`, `POST /auth/login`, and `POST /auth/select-workshop` as public auth entry points, and `POST /auth/switch-workshop`, `POST /workshops/{workshopId}/invitations`, `POST /workshops/{workshopId}/invitations/{invitationId}/revoke`, and `/users` as authenticated endpoints with the applicable `401`, `403`, and `409` outcomes.
(Previously: only protected users endpoints required Bearer auth and `POST /auth/login` was the sole documented public auth entry point.)

#### Scenario: Protected tenancy admin routes are documented with Bearer auth

- GIVEN the generated OpenAPI document
- WHEN a protected users or invitation-management operation is inspected
- THEN the operation declares Bearer authentication and owner-only authorization semantics

#### Scenario: Public onboarding and login routes remain unauthenticated in the contract

- GIVEN the generated OpenAPI document
- WHEN `POST /auth/register-workshop`, `POST /auth/login`, or `POST /auth/select-workshop` is inspected
- THEN the operation is documented without requiring Bearer authentication
