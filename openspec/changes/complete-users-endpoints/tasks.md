# Tasks: Complete Users Endpoints

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3 |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Validation, Argon2, seed bootstrap | PR 1 | Base slice; includes `package.json`, `pnpm-lock.yaml`, `src/main.ts`, `prisma/seed.ts` |
| 2 | DTOs, mapper, hasher, service behavior | PR 2 | Depends on PR 1; keep service tests in same slice |
| 3 | Controller, Swagger, e2e verification | PR 3 | Depends on PR 2; HTTP contract only |

## Phase 1: Foundation

- [x] 1.1 RED: add failing bootstrap specs for `src/main.ts` validation setup and `prisma/seed.ts` role upserts covering every `UserRole`.
- [x] 1.2 GREEN: update `package.json` and `pnpm-lock.yaml`, enable global `ValidationPipe` in `src/main.ts`, and add `prisma/seed.ts` plus seed script.
- [x] 1.3 REFACTOR: keep bootstrap-only wording aligned in seed comments/docs and confirm no JWT/RBAC wiring is introduced.

## Phase 2: Users domain behavior

- [x] 2.1 RED: create `src/modules/users/users.service.spec.ts` for create success, duplicate email `409`, missing role `503`, not found `404`, and sanitized mapping.
- [x] 2.2 RED: expand `src/modules/users/users.controller.spec.ts` with DTO/route delegation expectations for create, list, and detail.
- [x] 2.3 GREEN: add `src/common/security/password-hasher.service.ts` and wire `src/modules/users/users.module.ts` to provide Prisma and hashing collaborators.
- [x] 2.4 GREEN: create `src/modules/users/dto/create-user.dto.ts` and `src/modules/users/dto/user-response.dto.ts` with validation and Swagger metadata.
- [x] 2.5 GREEN: implement `src/modules/users/users.service.ts` create/findAll/findOne, role lookup by enum, password hashing, Prisma error translation, and response mapper.
- [x] 2.6 REFACTOR: extract reusable mapper/helpers inside `src/modules/users/users.service.ts` without exposing `passwordHash` or `roleId`.

## Phase 3: HTTP contract and integration

- [x] 3.1 RED: create `test/users.e2e-spec.ts` for `POST /users`, `GET /users`, `GET /users/:id`, invalid body `400`, invalid UUID `400`, duplicate `409`, and missing user `404`.
- [x] 3.2 GREEN: implement `src/modules/users/users.controller.ts` with `POST /users`, `GET /users`, `GET /users/:id`, `ParseUUIDPipe`, and bootstrap-only Swagger summaries/responses.
- [x] 3.3 GREEN: ensure `src/modules/users/users.module.ts` exports the final controller/service wiring used by e2e overrides.

## Phase 4: Verification

- [x] 4.1 Run `pnpm test` and fix failing unit/controller specs introduced by Phases 1-3.
- [x] 4.2 Run `pnpm test:e2e` and verify the bootstrap contract matches `openspec/changes/complete-users-endpoints/specs/users-bootstrap-endpoints/spec.md`.
- [x] 4.3 Run `pnpm build` and confirm Swagger-visible DTOs omit `passwordHash` and public `roleId`.
- [x] 4.4 Add focused OpenAPI contract coverage for users endpoint operations, bootstrap-only disclosure, documented responses, and sanitized public response schemas.
