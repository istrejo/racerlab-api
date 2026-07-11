# Proposal: Complete Users Endpoints

## Intent

Close the missing users checklist with a safe bootstrap slice: validated `POST /users`, `GET /users`, and `GET /users/:id` plus Swagger contract coverage. This change exists to unblock internal setup and frontend contract work before Auth/RBAC is implemented.

## Scope

### In Scope
- Add initial users DTOs and Swagger-documented create/list/detail contracts.
- Plan global `ValidationPipe`, `class-validator`/`class-transformer`, and password hashing before persisting users.
- Include role bootstrap/seed so user creation can resolve `UserRole` even though `roles` is empty.

### Out of Scope
- JWT, login, refresh, guards, RBAC, or `@ApiBearerAuth()`.
- User update/delete flows, permissions management, or public production access hardening.

## Capabilities

### New Capabilities
- `users-bootstrap-endpoints`: Temporary bootstrap-only user create/list/detail endpoints with validated DTOs, hashed passwords, role-name contract mapping, and Swagger documentation.

### Modified Capabilities
None.

## Approach

Implement the users API as a temporary private/bootstrap capability: Prisma-backed service behavior, enum-to-role lookup, sanitized response DTOs, explicit validation, and hash-before-save behavior. Mark the endpoints in docs as temporary until Auth/RBAC replaces open access.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/users/users.controller.ts` | Modified | Add `POST /users`, `GET /users`, `GET /users/:id` and Swagger decorators |
| `src/modules/users/users.service.ts` | Modified | Add create/list/detail behavior, duplicate-email and missing-role handling, password hashing orchestration |
| `src/modules/users/users.module.ts` | Modified | Wire Prisma and hashing collaborators |
| `src/modules/users/dto/*.ts` | New | Request/response DTOs that never expose `passwordHash` |
| `src/main.ts` | Modified | Enable global `ValidationPipe` |
| `package.json` | Modified | Add validation and password-hashing dependencies |
| `prisma/seed.*` | Modified/New | Bootstrap initial roles required for user creation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unauthenticated endpoints expose internal user data | High | Document as temporary/bootstrap only and keep JWT/RBAC follow-up explicit |
| Empty `roles` table blocks `POST /users` | High | Seed/bootstrap initial roles in the same change |
| Weak input/credential handling creates security debt | Med | Require DTO validation and password hashing in scope, not later |

## Rollback Plan

Revert the users route/service/DTO changes, remove temporary bootstrap wiring and added dependencies, and roll back the role seed if it exists only for this change.

## Dependencies

- `class-validator` and `class-transformer`
- Password hashing library (`argon2` preferred; `bcrypt` acceptable fallback)
- Role bootstrap/seed execution path

## Success Criteria

- [ ] Proposal covers create/list/detail users endpoints without expanding beyond PRD/TRD scope.
- [ ] Validation, hashing, Swagger, and role bootstrap are required implementation scope items.
- [ ] Security caveat is explicit: endpoints are temporary/bootstrap only until Auth/RBAC exists.
