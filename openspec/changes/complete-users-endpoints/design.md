# Design: Complete Users Endpoints

## Technical Approach

Implement the users API as a temporary bootstrap slice in the existing `UsersModule`: validated DTOs at the NestJS boundary, password hashing in an injectable collaborator, Prisma-backed service methods, sanitized response DTO mapping, and Swagger-documented `POST /users`, `GET /users`, and `GET /users/:id`. JWT/Auth/RBAC remain out of scope; documentation must label these endpoints as bootstrap-only until guarded auth exists. No Prisma schema change is needed.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Validation boundary | Enable global `ValidationPipe` in `src/main.ts` with `whitelist`, `forbidNonWhitelisted`, and `transform`. | Per-route pipes only. | The app currently has no validation stack; global validation protects every write endpoint consistently once DTOs exist. |
| Hashing location | Add an injectable password hasher under `src/common/security/` and call it from `UsersService.create`. | Hash in controller, DTO, or Prisma middleware. | Hashing is credential/business orchestration: controllers should delegate, DTOs should validate only, and middleware would hide explicit behavior from tests. |
| Hash library | Add `argon2` as runtime dependency. | `bcrypt`. | Argon2 is the preferred password hashing default; keep it behind an interface so bcrypt remains a fallback if runtime installation blocks apply. |
| API role contract | Accept/return Prisma `UserRole` enum names, never raw `roleId`. | Expose database IDs. | Stable frontend contract and avoids coupling clients to bootstrap database rows. |
| Prisma errors | Catch duplicate email as Prisma `P2002` and return `ConflictException`. Missing role returns a clear bootstrap error. | Generic 500s. | Service methods should translate expected persistence failures into API-safe errors. |
| Role bootstrap | Add `prisma/seed.ts` with role `upsert` for every `UserRole` and a package seed command. | Create roles lazily during user creation. | Seeded roles make startup state explicit and avoid writes with hidden side effects in request handling. |

## Data Flow

```text
POST /users
  Controller DTO validation
      -> UsersService.create
          -> Role lookup by UserRole
          -> PasswordHasher.hash(password)
          -> prisma.user.create({ include: { role: true } })
          -> mapUserToResponse(user)
      -> UserResponseDto without passwordHash/roleId
```

`GET /users` and `GET /users/:id` query users with `include: { role: true }`, order list results by `createdAt` descending, and use the same response mapper. `ParseUUIDPipe` validates `:id`; missing users return `NotFoundException`.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Modify | Add `class-validator`, `class-transformer`, `argon2`, and Prisma seed command. |
| `src/main.ts` | Modify | Register global `ValidationPipe` before Swagger/listen. |
| `src/common/security/password-hasher.service.ts` | Create | Encapsulate Argon2 hashing behind injectable service. |
| `src/modules/users/dto/create-user.dto.ts` | Create | Validate `name`, `email`, `password`, `role`, optional `isActive`; document Swagger schema. |
| `src/modules/users/dto/user-response.dto.ts` | Create | Swagger response DTO: `id`, `name`, `email`, `role`, `isActive`, `createdAt`, `updatedAt`. |
| `src/modules/users/users.module.ts` | Modify | Import `PrismaModule`; provide password hasher. |
| `src/modules/users/users.service.ts` | Modify | Add `create`, `findAll`, `findOne`, role lookup, hashing, mapping, and expected error translation. |
| `src/modules/users/users.controller.ts` | Modify | Add routes and Swagger decorators; no auth decorators yet. |
| `prisma/seed.ts` | Create | Upsert role rows for all `UserRole` values. |
| `src/modules/users/*.spec.ts`, `test/users.e2e-spec.ts` | Modify/Create | Strict TDD coverage for service, controller, validation, and e2e route behavior. |

## Interfaces / Contracts

`CreateUserDto`: `name: string`, `email: string`, `password: string`, `role: UserRole`, `isActive?: boolean`.

`UserResponseDto`: `id`, `name`, `email`, `role`, `isActive`, `createdAt`, `updatedAt`. It MUST NOT expose `passwordHash` or `roleId`.

Service contract: `create(dto): Promise<UserResponseDto>`, `findAll(): Promise<UserResponseDto[]>`, `findOne(id): Promise<UserResponseDto>`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | UsersService success, duplicate email, missing role, not found, response mapping excludes secrets. | Write failing Jest specs first with mocked Prisma and hasher. |
| Controller | Delegation, UUID pipe usage, Swagger-visible route methods. | Controller specs with mocked service. |
| E2E | `POST`, `GET /users`, `GET /users/:id`, invalid body `400`, invalid UUID `400`, duplicate `409`, missing user `404`. | Follow health e2e pattern; override Prisma and hasher, call shared validation setup. |

## Migration / Rollout

No schema migration required. Rollout requires installing dependencies, running Prisma generate if needed, and executing the seed so `roles` contains every `UserRole` before `POST /users` is used. Deploy only in trusted/bootstrap environments until Auth/RBAC guards are added.

## Open Questions

- [ ] None blocking. If Argon2 installation fails in the target environment, switch the hasher implementation to bcrypt without changing controller/service contracts.
