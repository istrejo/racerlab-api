```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:989f008ab52df522afc3ad803bd4e1591c42f3cf7c371fff935bb81bc3cde69e
verdict: pass
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 4/9
test_command: pnpm test -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts
test_exit_code: 0
test_output_hash: sha256:0480af726ec6d0a525d4001f8967b0863ea812fb1f5d6718902cfc040e1f9a4f
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:ce0b8b56e01cdfaeb76197e9764cf9352f42bcfb742239accabc7acd8db53379
```

## Verification Report

**Change**: `protect-users-with-auth-rbac` — PR3 `users-admin-rbac` rerun  
**Version**: N/A  
**Mode**: Strict TDD, hybrid persistence  
**Scope**: Re-ran strict verification for the PR3 slice after artifact-only remediation. Current runtime execution in this rerun covers focused PR3 unit/OpenAPI, focused PR3 e2e, coverage, lint, and build on the present workspace. Historical last-green full-suite hashes are preserved below because this rerun did not re-execute `pnpm test` / `pnpm test:e2e` / repository-wide coverage.

### Completeness

| Metric | Value |
|---|---:|
| Requirements retrieved (full change) | 4 |
| Scenarios retrieved (full change) | 9 |
| PR3 scenarios verified in scope | 4 |
| PR3 work-unit task lines | 4 |
| PR3 work-unit task lines fully verified complete | 4 |
| Whole-change task lines checked complete | 9/11 |
| Whole-change task lines intentionally pending | 2 |

This rerun certifies the PR3 auth/RBAC slice only. The remaining unchecked whole-change work stays limited to email normalization (`1.3`, `3.1`), which remains outside PR3 and therefore keeps the full change from archive readiness.

### Build & Tests Execution

| Command | Exit | Result | SHA-256 output hash |
|---|---:|---|---|
| `pnpm test -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts` | 0 | 3 suites, 12 tests passed | `sha256:0480af726ec6d0a525d4001f8967b0863ea812fb1f5d6718902cfc040e1f9a4f` |
| `pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts` | 0 | 1 suite, 21 tests passed | `sha256:a0411673799c9814f7e7f2c29612a38c9441a5c5c2301dbb92bd4a2b4287f832` |
| `pnpm test:cov -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts` | 0 | 3 suites, 12 tests passed with coverage output | `sha256:50d8437dbf6bc7610b7305a253eed49e82004ca0a555d8281326203fbee55345` |
| `pnpm lint` | 0 | Passed | `sha256:a95ffc959200be4d267e00ff8973d190d20928fce66201205949750c32481830` |
| `pnpm build` | 0 | Passed | `sha256:ce0b8b56e01cdfaeb76197e9764cf9352f42bcfb742239accabc7acd8db53379` |

Historical last-green full-suite evidence preserved from the prior successful strict verification on the same PR3 slice:

| Historical command | Exit | SHA-256 output hash |
|---|---:|---|
| `pnpm test` | 0 | `sha256:67f727bcd337c4edb16ba5fd9db45db88827b5e4d013b43b7d839a3b783a72c7` |
| `pnpm test:e2e` | 0 | `sha256:dbfcfd645f597d66ec4dae6d6117650694740c10220b68562a252d1eb7f18d34` |
| `pnpm test:cov` | 0 | `sha256:6fd700cd1534262bc5623c1bca163ec28ba53884e1f6c033df5cb33a4560e95c` |

### Spec Compliance Matrix — PR3 Scope

| Requirement | Scenario | Runtime test | Result |
|---|---|---|---|
| ADMIN-Only Users Endpoints | Allow an authenticated ADMIN request | `test/users.e2e-spec.ts` exercises `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id` with an ADMIN JWT and gets `201/200` success | ✅ COMPLIANT |
| ADMIN-Only Users Endpoints | Block anonymous or non-ADMIN access | `test/users.e2e-spec.ts` exercises the same four routes anonymously (`401`) and as a MANAGER (`403`) | ✅ COMPLIANT |
| Swagger Bearer Contract | Protected users route is documented with Bearer auth | `src/modules/users/users.openapi.spec.ts` asserts Bearer security on all four users operations and on the shared `bearer` scheme | ✅ COMPLIANT |
| Swagger Bearer Contract | Login route remains the public auth entry point | `src/modules/auth/auth.openapi.spec.ts` asserts `POST /auth/login` has no operation security while the global Bearer scheme still exists | ✅ COMPLIANT |

**Compliance summary**: 4/4 PR3 scenarios are compliant. Across the retrieved full change there are 4 requirements and 9 scenarios total; the non-PR3 `Normalize email identity consistently` scenario remains pending and is not certified by this slice.

### Correctness (Static Evidence)

| Area | Status | Notes |
|---|---|---|
| Users controller protection | ✅ Implemented | `UsersController` applies `JwtAuthGuard`, `RolesGuard`, and `@Roles(UserRole.ADMIN)` at class scope. |
| Anonymous / non-ADMIN denial matrix | ✅ Implemented | Current focused e2e covers `401` and `403` outcomes for every current users endpoint. |
| ADMIN success path | ✅ Implemented | Current focused e2e covers all four users endpoints with successful ADMIN access and preserved validation/conflict/not-found cases. |
| Swagger global Bearer contract | ✅ Implemented | Shared `createSwaggerDocumentBuilder()` exposes the `bearer` security scheme for runtime docs and tests. |
| Public login boundary | ✅ Preserved | `AuthController` exposes only `POST /auth/login`; OpenAPI remains public for that operation. |
| Artifact wording alignment | ✅ Implemented | `tasks.md`, `design.md`, and `apply-progress.md` no longer claim that `UsersController` uses `@CurrentUser()`. |
| Email normalization follow-up scope | ⚠️ Deferred | `tasks.md` and `apply-progress.md` still mark `1.3` and `3.1` as pending outside PR3. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Users routes become ADMIN-only via shared JWT/RBAC guards | ✅ Yes | Controller-level guards and role metadata match the design intent. |
| Swagger publishes a reusable Bearer scheme | ✅ Yes | Runtime docs and OpenAPI tests use the same builder. |
| `POST /auth/login` remains public | ✅ Yes | Auth OpenAPI contract keeps operation security undefined for login. |
| PR3 artifacts describe implemented controller protection only | ✅ Yes | `@CurrentUser()` is still documented as a reusable decorator, but not as a `UsersController` mechanism. |
| Shared lowercase email normalization across login/create/update | ⚠️ Deferred | Still pending in tasks `1.3` and `3.1`; outside PR3 scope but still part of the full change design. |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | `apply-progress.md` contains PR3 rows for `1.2`, `3.2`, `3.3`, `4.1`, and `4.2`. |
| All relevant test files exist | ✅ | `users.controller.spec.ts`, `users.openapi.spec.ts`, `auth.openapi.spec.ts`, and `users.e2e-spec.ts` exist. |
| RED confirmed from preserved lineage | ✅ | Apply-progress preserves pre-change failing focused evidence for controller/OpenAPI/users-route denial expectations. |
| GREEN reconfirmed by current execution | ✅ | Current focused unit/OpenAPI, focused e2e, coverage, lint, and build are all green. |
| Triangulation adequate | ✅ | PR3 covers anonymous denial, non-ADMIN denial, ADMIN success, and protected/public OpenAPI variance. |
| Safety net for modified files | ✅ | Apply-progress preserves baseline focused checks before the PR3 implementation change. |

**TDD compliance**: 6/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tool |
|---|---:|---:|---|
| Unit | 5 | 1 | Jest |
| Integration/OpenAPI | 7 | 2 | Jest + Nest Swagger document generation |
| E2E | 21 | 1 | Jest + Supertest |
| **Total** | **33** | **4** | |

### Changed File Coverage

| File | Lines | Branches | Uncovered lines | Rating |
|---|---:|---:|---|---|
| `src/modules/users/users.controller.ts` | 100% | 75% | — | ✅ Excellent |
| `src/config/swagger.config.ts` | 57.14% | 100% | 23-27 | ⚠️ Low |

**Average changed file coverage**: 78.57% lines.

### Assertion Quality

**Assertion quality**: ✅ All PR3 verification tests invoke controller metadata, generated OpenAPI output, or HTTP behavior and assert meaningful authorization/contract outcomes.

### Quality Metrics

**Linter**: ✅ No errors  
**Type/build check**: ✅ `pnpm build` passed

### Canonical Verification Evidence

```json
{"change":"protect-users-with-auth-rbac","scope":"PR3 users-admin-rbac rerun","strict_tdd":true,"artifact_alignment":{"users_controller_current_user_claim_removed":true,"email_normalization_pending_outside_pr3":true},"current":{"focused_unit":{"command":"pnpm test -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts","exit_code":0,"output_hash":"sha256:0480af726ec6d0a525d4001f8967b0863ea812fb1f5d6718902cfc040e1f9a4f"},"focused_e2e":{"command":"pnpm test:e2e -- --runTestsByPath test/users.e2e-spec.ts","exit_code":0,"output_hash":"sha256:a0411673799c9814f7e7f2c29612a38c9441a5c5c2301dbb92bd4a2b4287f832"},"coverage":{"command":"pnpm test:cov -- --runTestsByPath src/modules/users/users.controller.spec.ts src/modules/users/users.openapi.spec.ts src/modules/auth/auth.openapi.spec.ts","exit_code":0,"output_hash":"sha256:50d8437dbf6bc7610b7305a253eed49e82004ca0a555d8281326203fbee55345"},"lint":{"command":"pnpm lint","exit_code":0,"output_hash":"sha256:a95ffc959200be4d267e00ff8973d190d20928fce66201205949750c32481830"},"build":{"command":"pnpm build","exit_code":0,"output_hash":"sha256:ce0b8b56e01cdfaeb76197e9764cf9352f42bcfb742239accabc7acd8db53379"}},"historical_full_last_green":{"test":{"command":"pnpm test","exit_code":0,"output_hash":"sha256:67f727bcd337c4edb16ba5fd9db45db88827b5e4d013b43b7d839a3b783a72c7"},"test_e2e":{"command":"pnpm test:e2e","exit_code":0,"output_hash":"sha256:dbfcfd645f597d66ec4dae6d6117650694740c10220b68562a252d1eb7f18d34"},"coverage":{"command":"pnpm test:cov","exit_code":0,"output_hash":"sha256:6fd700cd1534262bc5623c1bca163ec28ba53884e1f6c033df5cb33a4560e95c"}}}
```

### Issues Found

**WARNING**:
1. The full change still has pending non-PR3 follow-up work for shared email normalization (`1.3`, `3.1`), so the change is not archive-ready even though the requested PR3 behavior is green.
2. `src/config/swagger.config.ts` remains below the 80% changed-file coverage threshold (57.14% lines). This is informational only because runtime OpenAPI checks passed.

**SUGGESTION**:
1. Finish the deferred email-normalization work so the full change can satisfy the `Normalize email identity consistently` scenario and close the remaining 2 unchecked task lines.

### Verdict

**PASS — PR3 strict SDD slice.** The requested PR3 runtime behavior, Swagger contract, and artifact wording are aligned on the current workspace. The full change still remains outside archive readiness because the deferred email-normalization follow-up (`1.3`, `3.1`) is intentionally pending beyond PR3.
