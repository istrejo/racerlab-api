# Workshop Tenancy Specification

## Purpose

Define ownership, workshop-scoped membership authorization, tenant isolation, and manual user onboarding.

## Requirements

### Requirement: Single Workshop Owner

Each workshop MUST have exactly one active `OWNER` membership and its user MUST match `Workshop.ownerUserId`. `OWNER` MUST satisfy every `ADMIN` permission.

#### Scenario: Create a workshop

- GIVEN an authenticated global user
- WHEN the user creates a workshop
- THEN the workshop and exactly one active OWNER membership are committed atomically

#### Scenario: Transfer ownership

- GIVEN the current OWNER selects another membership in the same workshop
- WHEN ownership is transferred
- THEN the workshop row is locked, the target becomes active OWNER, ownerUserId changes, and the previous OWNER becomes ADMIN in one transaction

### Requirement: Tenant Isolation

Every operational query and relation MUST include the active `workshopId`. A resource identifier from another workshop MUST behave as not found.

#### Scenario: Manipulated resource identifier

- GIVEN a user is authenticated in workshop A
- WHEN the user submits an identifier belonging to workshop B
- THEN no workshop B data is returned or changed

### Requirement: Membership Administration

`ADMIN` and `OWNER` MAY create, list, and update memberships. Generic membership writes MUST NOT assign, deactivate, or demote `OWNER`. An actor MUST NOT change their own role or activation state.

### Requirement: Manual User Onboarding

`ADMIN` and `OWNER` MAY create a new global identity and active membership atomically with name, normalized email, workshop profile, non-OWNER role, and temporary password. The API MUST store only the Argon2 password hash, MUST reject any globally existing email without linking or modifying that identity, and MUST mark the new user for mandatory password change.

#### Scenario: Create a workshop user manually

- GIVEN an ADMIN or OWNER has an active workshop context
- WHEN valid profile, role, email, and temporary password data is posted to `/memberships`
- THEN a global user and active workshop membership are committed together

#### Scenario: Reject a duplicate global identity

- GIVEN an email already belongs to any global user
- WHEN an administrator tries to create it in the current workshop
- THEN the API returns conflict and does not link or modify the existing identity

### Requirement: Administrator Password Reset

`ADMIN` and `OWNER` MAY set a temporary password for another non-OWNER membership whose identity belongs to exactly one workshop. The operation MUST revoke all target sessions and require another first-access password change.

#### Scenario: Protect a shared identity

- GIVEN a target user has memberships in more than one workshop
- WHEN an administrator attempts a workshop-local password reset
- THEN the API rejects the reset without changing the global credential
