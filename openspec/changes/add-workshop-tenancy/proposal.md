# Proposal: Add Workshop Tenancy

## Intent
The single-workshop model cannot represent cross-workshop staff safely. Introduce global `User`, membership-scoped authorization/sessions, single ownership, and isolation.

## Scope
### In Scope
- Add `Workshop`, `Membership`, and `Invitation`; assign roles through memberships, not `User.roleId`.
- Require unique `Workshop.ownerUserId`, one OWNER/workshop, one owned workshop/user, and a matching active OWNER membership. Owners may join others as non-OWNER.
- `POST /auth/register-workshop` atomically creates owner, workshop, membership, session, and tokens; conflicts return `409`.
- Invitations expire after seven days, are revocable pre-acceptance, single-use, and hash-only.
- One active membership logs in directly. Multiple return a restricted token and workshops; `POST /auth/select-workshop` completes login.
- Authenticated `POST /auth/switch-workshop` validates the target active membership, consumes the refresh session atomically, creates a same-family target-bound replacement, and mints a scoped access token. The prior access token remains original-workshop-only until expiry.
- Active workshop belongs to the session, never `User`; concurrent sessions may differ. `Membership` is canonical; persisted `userId`/`membershipId` must agree.
- Enforce workshop-scoped composite uniqueness and relational integrity, not query filters alone.

### Out of Scope
- Ownership transfer/replacement, co-owners, additional ownership, platform operators, custom roles, or email delivery.

## Capabilities
### New Capabilities
- `workshop-tenancy`: Ownership, memberships, invitations, session context, isolation.

### Modified Capabilities
- `user-auth`: Membership-bound onboarding, authentication, selection, and switching.
- `users-access-control`: Membership roles and OWNER invariants.

## Approach
Use `Membership` as the auth/session boundary, rotate refresh sessions on context change, and enforce integrity in storage and application authorization.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| Prisma schema | Modified | Tenant constraints. |
| Auth/common | Modified | Membership auth, context, guards, auditing. |
| Users/workshops/memberships/invitations | New/Modified | Administration and ownership. |
| Customer, vehicle, order, diagnosis, quote, inventory, task, evidence, report modules | Modified | Ownership and cross-tenant rejection. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration data/constraint collisions | High | Preflight, deterministic backfill, transactional migration. |
| Existing sessions lack memberships | High | Explicitly migrate or invalidate them. |
| Cross-workshop leakage/relations | High | Database integrity, mandatory context, authorization, isolation tests. |
| Ownership/token-family drift | Med | Atomic writes and rejected inconsistencies. |

## Rollback Plan
Before apply, discard the change. After rollout, restore schema/data and auth, revoke sessions, and revert together.

## Dependencies
- Delta `user-auth`/`users-access-control` specs and new `workshop-tenancy` spec.

## Success Criteria
- [ ] Each workshop has one active OWNER membership; no user owns multiple workshops.
- [ ] Requests resolve one active membership and cannot cross workshops.
- [ ] Invitation expiry, revocation, single-use, and hashed storage are enforced.
- [ ] Login selection and switching scope credentials without mutating global user state.
