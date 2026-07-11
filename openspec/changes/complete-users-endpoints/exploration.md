## Exploration: complete-users-endpoints

### Current State
`UsersModule` is registered in `AppModule`, but `src/modules/users/users.controller.ts` only declares `@ApiTags('users')` and `@Controller('users')`, while `users.service.ts` is empty. Swagger is mounted globally at `/api/docs`, but no users operations or DTO schemas are documented yet. Prisma already defines `User` with required `password_hash`, `role_id`, unique `email`, and `is_active`, but the current Supabase database has **zero rows** in both `roles` and `users`, so `POST /users` cannot succeed without a role-bootstrap strategy. `package.json` does **not** include `class-validator`, `class-transformer`, or any password-hashing dependency, and `src/main.ts` does **not** enable `ValidationPipe`.

### Affected Areas
- `src/modules/users/users.module.ts` — must import `PrismaModule`; later implementation may also register a hash provider and temporary bootstrap gate.
- `src/modules/users/users.controller.ts` — must add `POST /users`, `GET /users`, `GET /users/:id`, UUID param validation, and Swagger response/error decorators.
- `src/modules/users/users.service.ts` — must add Prisma-backed create/list/detail behavior, duplicate-email handling, role lookup, not-found handling, and password hashing orchestration.
- `src/modules/users/dto/*.ts` — missing DTOs; needs request/response DTOs that never expose `passwordHash` and expose `role` as `UserRole` rather than raw `roleId`.
- `src/main.ts` — must enable `ValidationPipe` if DTO validation is added.
- `package.json` — needs validation dependencies and a password-hashing library before `POST /users` is safe to implement.
- `prisma/schema.prisma` — no schema change is needed, but the existing `User`/`Role` constraints drive the endpoint contract and bootstrap requirement.
- `src/modules/users/users.controller.spec.ts` and `test/` — should expand from the current compile test into strict-TDD unit and e2e coverage for routes, validation, and error mapping.

### Approaches
1. **Direct unauthenticated endpoints** — Add the three routes with minimal DTO mapping and no temporary sequencing safeguards.
   - Pros: Fastest way to close the checklist.
   - Cons: Unsafe without auth, leaks internal user data, risks coupling the API to database IDs, and still fails unless hashing and role data are added.
   - Effort: Low

2. **Bootstrap-only endpoints with explicit safeguards** — Keep JWT out for now, but add DTO validation, password hashing, sanitized responses, `UserRole`-based contract mapping, and a temporary environment/private-deployment gate until AuthModule exists.
   - Pros: Meets the checklist with less security debt, preserves a stable frontend contract, and keeps stored credentials reusable by the future AuthModule.
   - Cons: Still not public-production safe; requires validation, hashing, and role bootstrap work in the same change.
   - Effort: Medium

### Recommendation
Use **Bootstrap-only endpoints with explicit safeguards**.

Recommended contract:
- `POST /users` body: `name`, `email`, `password`, `role: UserRole`, optional `isActive`
- `GET /users` response: `UserResponseDto[]`
- `GET /users/:id` response: `UserResponseDto`
- `UserResponseDto`: `id`, `name`, `email`, `role`, `isActive`, `createdAt`, `updatedAt`

Design notes:
- Resolve the incoming `role` enum to a `roles.name` row in the service; do **not** expose `roleId` in the API contract.
- Never return or document `passwordHash`.
- Password hashing is mandatory before persisting users. Prefer `argon2` if the target build/runtime accepts it; fallback to `bcrypt` if deployment simplicity outweighs the stronger default.
- Treat missing role rows as a bootstrap problem that must be solved in the same change via seed/bootstrap strategy; the current database has no role records.
- Do **not** add JWT or `@ApiBearerAuth()` yet; instead, document these as temporary bootstrap endpoints.

Strict-TDD test slices for the later apply phase:
- Unit specs for `UsersService`: create success, duplicate email conflict, missing role bootstrap failure, list mapping, detail not-found.
- Controller/unit specs: route delegation and exception propagation.
- E2E specs: `POST /users`, `GET /users`, `GET /users/:id`, invalid UUID `400`, invalid payload `400`, missing user `404`, duplicate email `409`.
- E2E tests should follow the existing health pattern by overriding Prisma and hash collaborators rather than hitting the real database.

### Risks
- Unauthenticated `GET /users` and `GET /users/:id` expose internal staff data if deployed outside a trusted/private environment.
- Unauthenticated `POST /users` enables arbitrary account creation unless temporarily gated or kept off public deployment.
- The database currently has no `roles` seed data, so create-user will fail unless role bootstrap is included.
- No validation stack is installed today, so input safety is currently absent.
- No password-hashing dependency is installed today, so credential storage cannot be implemented safely yet.

### Ready for Proposal
Yes — but the orchestrator should tell the user that validation setup, password hashing, and role bootstrap data must be in scope for the proposal, not deferred as follow-up work.
