# Design: Add Workshop Tenancy

`Workshop` is the canonical tenant name and boundary. `User` becomes global identity only; an active `Membership` supplies the workshop, role, permissions, and session context. This implements the `workshop-tenancy`, `user-auth`, and `users-access-control` deltas without treating Prisma query filters as isolation.

## Technical Approach

```
Bearer access JWT {sub, mid, wid, typ=access}
        -> JwtStrategy reloads User + Membership -> ActiveWorkshopContext
        -> guards/decorators -> module service { workshopId, membershipId }
        -> composite-FK-scoped Prisma write/read
```

### Architecture decisions

| Decision | Alternatives / tradeoff | Rationale |
|---|---|---|
| `Workshop`, never generic `Tenant` | Alias/generalize later | Matches the domain and keeps API, storage paths, and audit language unambiguous. |
| Global `User`; `Membership(userId, workshopId, roleId)` owns authorization | Retain `User.roleId` | One identity can work in many workshops; authorization cannot be global. `User.roleId` is removed and `OWNER` is added to the seeded role enum/catalog. |
| Session binds `membershipId` and `userId` | User-only session | `AuthSession(membershipId,userId)` has FK `(membership_id,user_id)` to unique `Membership(id,user_id)` (`auth_session_membership_user_fk`), so persisted identity cannot drift. |
| Composite tenant FKs plus service context | Filters/RLS only | FK constraints reject impossible relations; services make every read and mutation tenant-aware. NestJS remains the business layer; Supabase RLS is not the authorization mechanism. |
| Opaque, hash-only invitation and selection tokens | Persist raw values / unrestricted JWT | SHA-256 of a 48-byte random base64url value is stored; raw values are returned once. `AuthSelection` records user, hash, expiry, and consumption, making restricted multi-workshop selection single-use. |

## Data Model and Invariants

Add `Workshop(id, name, ownerUserId UNIQUE)`, `Membership(id, userId, workshopId, roleId, isActive, revokedAt)`, `Invitation`, and `AuthSelection`; add non-null `workshopId` to every workshop-owned record: customers, vehicles, orders, order children/history/technicians, diagnoses, quotes/items, categories/products/movements, tasks, evidences, and comments. Replace global uniqueness with workshop scope: `(workshopId, plate)`, `(workshopId, code)`, `(workshopId, sku)`, `(workshopId, name)` category; retain global normalized `User.email`.

**Database-enforced:** named unique constraints `membership_user_workshop_unique`, `membership_id_user_unique`, `invitation_workshop_email_unique`, `customer_id_workshop_unique`, `vehicle_id_workshop_unique`, `service_order_id_workshop_unique`, and `inventory_product_id_workshop_unique`; token-hash uniqueness; indexed FK columns; composite FKs for every relation named in the spec (including order children, quote item/product, and movement/product/order). A deferred PostgreSQL constraint trigger on Workshop/Membership changes requires exactly one active `OWNER` membership matching `ownerUserId`; `ownerUserId UNIQUE` limits a user to one owned workshop. The deferred check permits atomic creation but rejects commit-time partial state.

**Service-enforced:** only registration creates an OWNER; no owner transfer/demotion/deactivation; owners create non-OWNER employees/invitations; role/permission policy; DTO normalization; resource-not-found masking. Services always receive `ActiveWorkshopContext` and query or write `where: { workshopId }`; relation IDs are resolved in that same transaction/context before mutation. Storage paths begin `workshops/{workshopId}/...`.

## Credential Flows and Transaction Boundaries

All transactions are short, contain no network/email work, and conditionally update consumed rows to defeat races.

```text
register: pre-hash password/token, then tx User + Workshop + OWNER Membership + AuthSession
login(1): active membership -> scoped JWT + refresh cookie
login(n): AuthSelection + choices, no cookie/access JWT -> select consumes selection tx -> session
switch: access context + refresh cookie -> consume current session, verify target membership, create same-family target session tx
refresh: verify session/user/membership -> consume + replacement same-membership tx
logout/logout-all: revoke current session / all user sessions; clear cookie
```

JWTs carry `sub`, `mid`, `wid`, `typ`; `JwtStrategy` rejects selection tokens and reloads active user/membership, requiring all claims and persisted session membership to agree. A pre-switch access JWT remains usable only against its original `wid` until its 15-minute expiry. Refresh/switch mismatch or reuse revokes that family; refresh is never a workshop switch. Invitation acceptance conditionally marks the invitation accepted and creates the membership in one transaction; expiry, revocation, prior acceptance, duplicate membership, or bad hash fails without state repair.

## Modules, API, and Errors

`AuthModule` owns registration, login, selection, switch, refresh, and logout. Create `WorkshopsModule`, `MembershipsModule`, and `InvitationsModule`; workshop routes own invitation issue/revoke and public `/invitations/accept` owns acceptance. Replace `AuthenticatedUser` with `ActiveWorkshopContext`; add `@CurrentWorkshop()`, membership-aware `@Roles()`, and guards requiring `typ=access`. `UsersService` lists and targets memberships only in the caller workshop; it cannot alter ownership.

DTOs/OpenAPI document public `register-workshop`, login, selection, and accept; Bearer-required switch, users, issue/revoke invitation; response DTO variants for direct versus selection login; and `401` invalid/expired/reused credential, `403` active-context/owner denial, `404` same-workshop resource absent, `409` unique/ownership/invitation conflicts. Never disclose login or token-state details.

## File Changes

| File/group | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma`, new tenancy migration | Modify/Create | Models, composite keys/FKs, deferred trigger, indexes, controlled reset. |
| `prisma/seed.ts` | Modify | Seed `OWNER` with existing role catalog; create no users/workshops. |
| `src/modules/auth/**`, `src/common/{auth,guards,decorators}/**` | Modify | Context JWT, selection/session rotation, decorators and guards. |
| `src/modules/{workshops,memberships,invitations}/**`, `src/modules/users/**` | Create/Modify | Tenancy administration and scoped employee APIs. |
| Existing and future business modules | Modify | Require context, scoped repository operations, relation checks, storage prefixes. |

## Migration, Rollback, and Delivery

This is a controlled reset, not an unsafe inferred backfill: preflight requires an approved backup and explicit reset authorization; if legacy operational/users/session rows exist without approval, fail before DDL. In the reset window, revoke sessions, truncate dependent legacy data in FK order, apply schema/trigger/index migration, regenerate Prisma, and seed roles. Production rollback restores the pre-reset snapshot and matching prior code; otherwise roll back the entire tenancy release and revoke issued sessions together.

Chain reviewable PRs (each <=400 changed lines): 1) reset/migration/schema/seed, 2) context guards and JWT revalidation, 3) session/login/select/switch, 4) workshops/memberships/invitations, 5+) one business-module isolation slice per PR. Each slice has migration-safe rollback; never deploy auth before schema/context.

## Testing Strategy

| Layer | Proof |
|---|---|
| Unit | owner policy, token hashing/state, selection boundaries, guard claims, conditional session-family revocation. |
| Prisma integration | named constraints, deferred owner trigger, all composite cross-workshop FKs, index-backed active-session queries. |
| E2E/OpenAPI | atomic registration rollback; invitation lifecycle; direct/selected login; switch and old-token isolation; inactive membership; users/resource cross-workshop denial; documented 401/403/404/409. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Open Questions

None. The controlled reset must receive explicit operational approval before implementation.
