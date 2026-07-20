# Tasks: Add Workshop Tenancy

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1200-1800 total; 700-1050 remaining after this slice |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 schema/reset -> PR2 context/guards -> PR3 login/select/session -> PR4 register-workshop -> PR5 switch/refresh/logout -> PR6 tenancy admin/users -> PR7 isolation/e2e |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Frozen Review Closure

- The former native review `review-fe59a06406c24926` is unrecoverable (`correction_required`) and is not part of this reconstruction slice.
- Do not recreate its lineage during the clean-worktree rebuild.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema/reset/seed | PR1 current slice | `pnpm test -- --runTestsByPath src/prisma/seed.spec.ts src/prisma/workshop-tenancy-schema.spec.ts src/prisma/workshop-tenancy-migration.spec.ts` | N/A reset-only | Prisma + reset docs |
| 2 | JWT context/guards | PR2 pending | `pnpm test -- --runTestsByPath src/modules/auth/jwt.strategy.spec.ts src/common/guards/roles.guard.spec.ts src/common/decorators/auth-request.decorators.spec.ts` | `pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts` | `src/common/**`, auth strategy |
| 3 | Login/select + membership-bound session issuance | PR3 pending | `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts src/modules/auth/auth-session.service.spec.ts` | `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` | login/select/session files only |
| 4 | Register-workshop atomic onboarding | PR4 pending | `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts src/modules/auth/auth.controller.spec.ts` | `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` | register DTO/controller/service paths |
| 5 | Switch + refresh/logout family rotation | PR5 pending | `pnpm test -- --runTestsByPath src/modules/auth/auth.service.spec.ts src/modules/auth/auth-session.service.spec.ts` | `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` | switch/refresh/logout paths |
| 6 | Workshops/invitations/users owner rules | PR6 pending | `pnpm test -- --runTestsByPath src/modules/users/users.service.spec.ts src/modules/users/users.controller.spec.ts` | `pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts` | tenancy modules + users |
| 7 | Isolation/OpenAPI/final e2e | PR7 pending | `pnpm test -- --runTestsByPath src/modules/auth/auth.openapi.spec.ts src/modules/users/users.openapi.spec.ts` | `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts` | docs/spec tests only |

## Phase 1: Reset and Schema

- [x] 1.1 Add RED Prisma/integration coverage for owner trigger, named constraints, cross-workshop FK rejection, and reset refusal without approval evidence (`prisma/**`, new migration tests).
- [x] 1.2 Update `prisma/schema.prisma`, new migration, `prisma/seed.ts`, and reset runbook for `Workshop`, `Membership`, `Invitation`, `AuthSelection`, `workshopId` propagation, `OWNER`, and required unique/FK names.

## Phase 2: Auth Context Foundation

- [ ] 2.1 Add RED tests in `src/modules/auth/*.spec.ts`, `src/common/guards/*.spec.ts`, and decorator specs for JWT claims `{sub,mid,wid,typ}`, restricted-selection denial, active-membership acceptance, and stale membership/session mismatch rejection.
- [ ] 2.2 Replace `src/common/auth/authenticated-user.ts` with membership-scoped context, update decorators/guards, and rework `src/modules/auth/jwt.strategy.ts` + module wiring to load `ActiveWorkshopContext` only from current user+membership state.

## Phase 3: Authentication Flows

- [ ] 3.1 Add RED tests for single-membership login, multi-membership restricted selection, `POST /auth/select-workshop` one-time exchange, membership-bound session persistence, and generic invalid-login/select failures in `src/modules/auth/*.spec.ts` and `test/auth.e2e-spec.ts`.
- [ ] 3.2 Implement `src/modules/auth/**` login/select-workshop/session issuance so single-membership login mints `{sub,mid,wid,typ=access}`, multi-membership login returns only a restricted selection token + choices, and sessions bind `membershipId`.
- [ ] 3.3 Add RED tests for `POST /auth/register-workshop` atomic owner/workshop/membership/session creation plus `409` rollback and normalized email handling.
- [ ] 3.4 Implement `register-workshop` DTO/controller/service flow in `src/modules/auth/**` using the shared membership-bound issuer/session helpers.
- [ ] 3.5 Add RED tests for authenticated `POST /auth/switch-workshop`, same-family refresh rotation, refresh-family reuse revocation, concurrent-session independence, and logout/logout-all scope.
- [ ] 3.6 Implement switch, refresh, logout, and logout-all session-family behavior in `src/modules/auth/**`, preserving pre-switch access-token workshop isolation until expiry.

## Phase 4: Tenancy Administration and Users

- [ ] 4.1 Add RED tests for owner-issued invitation create/revoke/accept-once, expiry/reuse/revocation rejection, non-`OWNER` employee-only creation, duplicate-membership block, and users same-workshop-only authorization.
- [ ] 4.2 Create `src/modules/{workshops,memberships,invitations}/**`, wire `src/app.module.ts`, scope `src/modules/users/**` to active `OWNER` memberships with cross-workshop masking, and update Swagger/OpenAPI docs for public vs Bearer tenancy routes.

## Phase 5: Isolation, Docs, and Final Gates

- [ ] 5.1 Add workshop-scoped checks anywhere current code touches workshop-owned Prisma models; require same-transaction relation resolution and `workshops/{workshopId}/...` storage prefixes.
- [ ] 5.2 Update `test/auth.e2e-spec.ts`, `test/users.e2e-spec.ts`, and `src/modules/*/*.openapi.spec.ts` for documented `401/403/404/409`, direct cross-workshop denial, invitation lifecycle, and auth-vs-tenancy route ownership.
- [ ] 5.3 Final merge gate: run focused Jest slices, `pnpm test:e2e -- --runTestsByPath test/auth.e2e-spec.ts test/users.e2e-spec.ts`, and `pnpm build` only after backup proof, controlled-reset approval, clean child diffs, and rollback notes per unit.
