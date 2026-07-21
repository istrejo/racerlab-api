# Workshop Tenancy Specification

## Purpose

Define `Workshop` as the tenant boundary, `Membership` as the authorization boundary, `Invitation` as employee onboarding, and storage/authorization isolation across workshop-owned records.

## Requirements

### Requirement: Canonical Workshop Ownership

The system MUST treat `Workshop` as the canonical tenant model. Each workshop MUST persist exactly one `ownerUserId`; each user MUST own at most one workshop globally; and each workshop MUST keep exactly one active `OWNER` membership whose `userId` matches `ownerUserId`. `OWNER` transfer, replacement, co-ownership, or inactive owner state MUST NOT be supported in this slice.

#### Scenario: Register a workshop with its owner

- GIVEN a new user registers a workshop successfully
- WHEN the workshop is created
- THEN the workshop stores that user as `ownerUserId` and one active `OWNER` membership exists for the same user

#### Scenario: Reject ownership invariant violations

- GIVEN a user already owns a workshop or the stored owner membership would be missing, inactive, or non-`OWNER`
- WHEN the system evaluates creation or mutation
- THEN the operation is rejected and the ownership state remains unchanged

### Requirement: Global Identity and Membership Catalogs

The system MUST keep `User` as global identity and `Membership` as workshop context. A user MAY hold memberships in multiple workshops but MUST NOT hold more than one membership in the same workshop. Roles and permissions MUST be resolved from the membership-linked catalogs, not from global user state. Only the active workshop owner MAY create or invite employee memberships, and `OWNER` MUST NOT be creatable or invitable outside workshop registration.

#### Scenario: Allow cross-workshop employment without cross-workshop ownership

- GIVEN a user owns workshop A and is invited to workshop B as a non-`OWNER`
- WHEN the invitation is accepted
- THEN the user keeps one ownership and gains one non-`OWNER` membership in workshop B

#### Scenario: Block duplicate or owner-forging memberships

- GIVEN a caller attempts a second membership for the same user/workshop or tries to create or invite `OWNER`
- WHEN the request is validated
- THEN the request is rejected

### Requirement: Invitation Lifecycle

The system MUST support owner-authenticated `POST /workshops/{workshopId}/invitations`, owner-authenticated revocation at `POST /workshops/{workshopId}/invitations/{invitationId}/revoke`, and public `POST /invitations/accept`. Invitations MUST store only a token hash, expire seven days after issuance, allow exactly one successful acceptance, and become unusable after revocation, expiry, or prior acceptance. The system MUST NOT send email in this slice.

#### Scenario: Accept a valid invitation once

- GIVEN an active owner issues an invitation and the token is unexpired and unused
- WHEN the recipient accepts it
- THEN one membership is created and the invitation cannot be accepted again

#### Scenario: Reject invalid invitation state

- GIVEN an invitation is expired, revoked, reused, or its raw token cannot be validated
- WHEN acceptance is attempted
- THEN the request is rejected without restoring the invitation to usable state

### Requirement: Tenant Integrity and Isolation

The system MUST enforce tenant integrity in storage and authorization, not by query filters alone. Required named constraints are `membership_user_workshop_unique`, `membership_id_user_unique`, `auth_session_membership_user_fk`, `invitation_workshop_email_unique`, `customer_id_workshop_unique`, `vehicle_id_workshop_unique`, `service_order_id_workshop_unique`, and `inventory_product_id_workshop_unique`, plus same-workshop foreign keys for vehicles→customers, orders→customers/vehicles, diagnoses/quotes/tasks/evidences/comments→orders, quote-items→quotes/products, and inventory-movements→products/orders. Inactive or revoked memberships MUST NOT authorize workshop resources.

#### Scenario: Reject direct cross-workshop reads

- GIVEN a caller has a valid membership in workshop A and knows a resource ID from workshop B
- WHEN the caller requests that resource directly
- THEN access is denied and no workshop B data is returned

#### Scenario: Reject cross-workshop relations

- GIVEN a write attempts to associate records that belong to different workshops
- WHEN the write is validated or persisted
- THEN the operation is rejected

### Requirement: Module and Verification Boundaries

The system MUST keep auth responsible for registration, login, selection, switching, refresh, and logout; workshops, memberships, and invitations responsible for tenancy administration; common authorization responsible for active-membership resolution; and every business module responsible for same-workshop rejection. Automated coverage MUST prove owner invariants, register-workshop atomic conflicts, invitation expiry/revocation/single-use, selection-token restrictions, switch rotation, inactive-membership denial, and direct cross-workshop access rejection.

#### Scenario: Publish boundary-aware API documentation

- GIVEN the generated OpenAPI document
- WHEN tenancy endpoints are inspected
- THEN auth flows and workshop or invitation administration are documented under their owning modules with their auth requirements
