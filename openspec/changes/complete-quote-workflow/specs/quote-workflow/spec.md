# Quote Workflow Specification

## Purpose

Define workshop-scoped quote versions and order synchronization.

## Requirements

### Requirement: Compatible Quote Data

Quotes MUST expose positive per-order `version`, optional `sourceQuoteId`, ISO 4217 `currencyCode` defaulting to `EUR`, and optional `approvalMethodDetail`. Versions MUST be unique per order. Migration MUST order legacy quotes by creation time and ID, link predecessors, apply `EUR`, normalize known methods, and preserve unknown methods as `OTHER` detail. It MUST abort atomically and report violations of the single-active-or-approved invariant.

#### Scenario: Migration

- GIVEN compatible legacy quotes, WHEN migrated, THEN deterministic versions, lineage, currency, and decisions are preserved.

#### Scenario: Conflict

- GIVEN conflicting active or approved quotes, WHEN preflight runs, THEN migration aborts and identifies them.

### Requirement: Initial Draft and Editing

`POST /service-orders/:serviceOrderId/quotes` MUST create only version 1 and return `409` if a quote exists. Draft writes MUST support manual items, absolute discount, tax, and currency. Only `DRAFT` quotes MAY be edited. Creation, editing, and versioning MUST require `DIAGNOSIS` or `QUOTED` orders.

#### Scenario: Creation

- GIVEN an eligible order without quotes, WHEN currency is omitted, THEN an `EUR` version 1 draft is created.

#### Scenario: Ineligible

- GIVEN an existing quote, non-draft target, or ineligible order, WHEN written, THEN `409 Conflict` occurs without changes.

### Requirement: Controlled Version Cloning

`POST /service-orders/:serviceOrderId/quotes/:id/versions` MUST clone only the latest eligible (`ACTIVE`, `REJECTED`, `EXPIRED`, `CANCELLED`, or `SUPERSEDED`) version. The next `DRAFT` MUST reference its source, copy items, adjustments, and currency, and clear decisions. Only one draft MAY exist. `DRAFT` and `APPROVED` MUST NOT be cloned.

#### Scenario: Cloning

- GIVEN the latest quote is eligible and no draft exists, WHEN versioned, THEN the next draft copies and references it.

#### Scenario: Concurrency

- GIVEN concurrent requests for one next version, WHEN executed, THEN one commits and one returns `409 Conflict`.

### Requirement: Quote Lifecycle

`DRAFT` MUST transition only to `ACTIVE` or `CANCELLED`; `ACTIVE` only to `APPROVED`, `REJECTED`, `EXPIRED`, or `CANCELLED`. New activation MUST atomically supersede the former active quote. Clients MUST NOT assign `SUPERSEDED`. Approved quotes MUST be immutable. Each order MUST have at most one `ACTIVE` or `APPROVED` quote.

#### Scenario: Replacement

- GIVEN an active quote and newer draft, WHEN activated, THEN the former is superseded and the draft becomes active atomically.

#### Scenario: Invalidity

- GIVEN a disallowed transition, WHEN requested, THEN `400 Bad Request` occurs without state changes.

### Requirement: Controlled Customer Decision

Approval and rejection MUST require `WHATSAPP`, `PHONE`, `IN_PERSON`, `EMAIL`, or `OTHER`. `OTHER` MUST require detail; other methods MUST reject detail. Method, permitted detail, and timestamp MUST be recorded.

#### Scenario: Decision

- GIVEN a missing method or inconsistent detail, WHEN deciding, THEN `400 Bad Request` occurs; valid input is recorded.

### Requirement: Service Order Synchronization

Quote and order changes MUST commit atomically. Activation MUST move `DIAGNOSIS` to `QUOTED`; approval MUST move `QUOTED` to `APPROVED`. Actual order transitions MUST append history. Rejection, expiry, or quote cancellation MUST leave `QUOTED`. Order cancellation MUST cancel `DRAFT` and `ACTIVE` quotes.

#### Scenario: Synchronization

- GIVEN a diagnosis order and draft, WHEN activated then approved, THEN the order reaches quoted then approved with history.

#### Scenario: Cancellation

- GIVEN an order with open quotes, WHEN cancelled, THEN its draft and active quotes are cancelled atomically.

### Requirement: Authorization and Errors

Reads MUST allow `OWNER`, `ADMIN`, `MANAGER`, `ADVISOR`, and `TECHNICIAN`; writes MUST allow only the first four. Access MUST use the active workshop. Missing or foreign resources MUST return `404`, forbidden roles `403`, invalid requests `400`, and state or concurrency conflicts `409`, without partial writes. OpenAPI MUST document fields, enums, operations, validation, and errors.

#### Scenario: Isolation

- GIVEN a foreign resource ID, WHEN accessed, THEN `404 Not Found` occurs without disclosure.

#### Scenario: Roles

- GIVEN a technician can read quotes, WHEN mutation is attempted, THEN `403 Forbidden` occurs.

#### Scenario: Activation

- GIVEN concurrent activations violate uniqueness, WHEN executed, THEN one commits and the loser receives `409 Conflict`.
