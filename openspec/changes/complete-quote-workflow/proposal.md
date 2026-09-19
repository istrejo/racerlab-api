# Proposal: Complete Quote Workflow

## Intent

Complete the manual quotation lifecycle so workshop staff can create traceable versions, record customer decisions, and keep the service order synchronized. Current CRUD lacks version identity, controlled decision methods, activation synchronization, and safe replacement of active quotes.

## Scope

### In Scope
- Add per-order versioning, lineage, ISO currency (default `EUR`), and `SUPERSEDED` status.
- Clone the latest eligible quote into a draft, preserving manual items and absolute adjustments.
- Enforce lifecycle rules, decision validation, tenancy, RBAC, immutability, and transactional history.
- Migrate existing quote data and publish the expanded OpenAPI contract.

### Out of Scope
- Inventory products, reservations, consumption, or stock effects.
- Partial/item approval, PDF generation, public approval links, or post-approval revisions.

## Capabilities

### New Capabilities
- `quote-workflow`: Manual quote creation, draft editing, version cloning, lifecycle transitions, controlled customer-decision capture, currency, order synchronization, and workshop-scoped authorization.

### Modified Capabilities
None.

## Approach

Extend Prisma with a compatibility migration that numbers and links existing quotes, defaults currency to `EUR`, and normalizes approval methods. Add invariants for unique per-order versions and one active/approved quote. Transactions will validate order and quote eligibility, supersede prior active versions, and append order history on activation or approval.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` and migrations | Modified | Persist new fields and invariants |
| `src/modules/quotes` | Modified | Expand contract, lifecycle, and tests |
| `src/modules/service-orders` | Modified | Synchronize order state and history |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Legacy data violates new uniqueness rules | Med | Preflight migration, deterministic backfill, and abort with diagnostics |
| Concurrent creation or activation produces conflicting versions | Med | Database constraints plus transactional conflict handling |
| Quote and order states diverge | Med | Commit both state changes and history atomically |

## Rollback Plan

Revert API behavior first, then apply a compensating migration only after exporting new field data. Preserve all quote and status-history records.

## Dependencies

- PostgreSQL partial unique indexes through a reviewed Prisma SQL migration.
- Existing workshop context, role policy, and service-order status history.

## Success Criteria

- [ ] Staff can complete the agreed create, edit, activate, decide, cancel, expire, and version lifecycle without inventory integration.
- [ ] Each order has deterministic versions and at most one active or approved quote under concurrent requests.
- [ ] Activation and approval synchronize the service order with auditable history.
- [ ] Migration, RBAC, tenancy, validation, OpenAPI, unit, integration, and build checks pass.
