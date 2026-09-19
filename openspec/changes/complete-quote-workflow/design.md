# Design: Complete Quote Workflow

## Technical Approach

Extend the existing NestJS quotes module and Prisma transaction pattern. A reviewed SQL migration backfills deterministic quote versions and decision data before enforcing database invariants. All writes serialize on the workshop-scoped service-order row, then validate quote/order state, mutate quotes, synchronize the order, and append history in one transaction.

## Architecture Decisions

| Decision | Choice | Alternatives / rationale |
|---|---|---|
| Legacy migration | Explicit PostgreSQL transaction: add nullable columns and enum values; preflight duplicate `ACTIVE`/`APPROVED` groups with an exception listing workshop/order IDs; rank legacy rows by `created_at, id`; set each `source_quote_id` to its immediate predecessor; normalize trimmed, case-insensitive `WHATSAPP`, `PHONE`, `IN_PERSON`, `EMAIL`, `OTHER`; preserve every unknown original value in `approval_method_detail`; set `EUR`; then apply non-null/default/check/index/FK constraints. | Direct non-null additions can lose legacy meaning or fail opaquely. Preflight before constraints makes rollout fail closed and diagnostic. |
| Lineage | Prisma named self-relation using `(workshopId, serviceOrderId, sourceQuoteId)` to a unique `(workshopId, serviceOrderId, id)` target, with `Restrict` deletion. | An ID-only relation could link another order or workshop. Restriction preserves audit lineage. |
| Currency | Store `currencyCode` as uppercase `VarChar(3)`, default `EUR`; DTO transformation trims/uppercases and a custom validator uses `Intl.supportedValuesOf('currency')` (Node ES2023), with no new dependency. | A three-letter regex accepts invented codes; a new package is unnecessary. |
| Customer decision | Persist `approvalMethod` as nullable Prisma `QuoteApprovalMethod`; keep detail nullable and bounded to 200 characters. Service validation requires method for approve/reject, requires detail only for `OTHER`, rejects detail otherwise, and rejects decision fields on non-decision transitions. | Free text cannot produce a stable API contract. Database enum plus conditional service validation supports legacy preservation and clear errors. |
| Concurrency | Interactive transactions acquire a parameterized `SELECT ... FOR UPDATE` lock on the tenant-scoped service-order row. Unique indexes enforce `(workshop_id, service_order_id, version)`, one `DRAFT`, and one row whose status is `ACTIVE` or `APPROVED`; expected unique/write conflicts map to `409`. | Read-before-write alone races. Locking one aggregate root serializes creation, cloning, activation, approval, and order cancellation; indexes remain the final guard. |
| Lifecycle sync | Activation supersedes an existing active quote before activating the draft and moves `DIAGNOSIS→QUOTED` with history. Approval requires `QUOTED`, moves it to `APPROVED`, and appends history. Other quote endings leave the order unchanged. Order cancellation updates `DRAFT`/`ACTIVE` quotes to `CANCELLED` in `ServiceOrdersService.changeStatus` within its transaction. State drift returns `409`, never a silent no-op. | Cross-service calls would create circular module coupling; direct transaction-client mutations keep the aggregate atomic. |

## Data Flow

```text
HTTP DTO → guard/workshop context → lock service order → validate aggregate
         → mutate/version quote → synchronize order + history → commit → response
```

## File Changes

| Area | Action | Description |
|---|---|---|
| `prisma/schema.prisma` + new migration | Modify/Create | Enums, fields, self-relation, backfill, checks, foreign keys, and partial unique indexes. |
| `src/modules/quotes/**` | Modify/Create | Version endpoint, currency/decision DTOs, lifecycle service logic, response mapping, OpenAPI, and tests. |
| `src/modules/service-orders/service-orders.service.ts` + spec | Modify | Lock cancellation and cancel open quotes atomically. |
| `src/prisma/workshop-tenancy-schema.spec.ts` | Modify | Assert migration preflight, deterministic backfill, constraints, and diagnostics. |

## Interfaces / Contracts

- Responses and summaries add `version`, `sourceQuoteId`, `currencyCode`, and `approvalMethodDetail`; `approvalMethod` becomes `QuoteApprovalMethod | null`; lists order newest version first.
- Create/update accept optional `currencyCode` (`EUR` default on create). `POST /service-orders/:serviceOrderId/quotes/:id/versions` returns `201 QuoteResponseDto` and accepts no body.
- Status input documents only client-assignable targets; `SUPERSEDED` is response-only. Controllers retain shared read/write role constants and document `400/403/404/409`.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | DTO currency/decision validation, totals, version eligibility, tenant isolation, lifecycle, order history/cancellation, and conflict translation. |
| Database | Apply the migration to disposable PostgreSQL fixtures for compatible legacy data and conflicting active/approved data; exercise concurrent create/clone/activate and both partial indexes. |
| Contract/E2E | OpenAPI fields/enums/route/errors/RBAC plus diagnosis → v1 → activate → v2 → activate/supersede → approve. |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable classification, or process-integration boundary is added; the new HTTP endpoint remains inside existing guarded NestJS routing.

## Migration / Rollout

Take a quote-table backup and run preflight in staging, then deploy migration before API/web consumers. Roll back application behavior first; database rollback is a compensating migration only after exporting new lineage, currency, and decision-detail columns. Do not remove status/history records. Stacked delivery targets `main` in contract/schema, lifecycle, then consumer order.

## Open Questions

None.
