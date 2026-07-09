# RacerLab API AI Instructions

Build the NestJS backend for RacerLab, a private workshop operations system. Keep the backend as the business layer and contract source for the Angular frontend.

## Product Boundary

- This repo owns the NestJS REST API, Prisma schema, migrations, seeds, Supabase PostgreSQL connection, and Supabase Storage integration.
- NestJS is the business layer. Do not move business workflows into Supabase clients, database-only logic, or the frontend.
- Supabase is the managed PostgreSQL and Storage provider only.
- Expose API contracts through OpenAPI/Swagger. The Angular frontend must align to this contract.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, database credentials, JWT secrets, or admin storage credentials to the frontend.

## Stack

- NestJS 11+
- TypeScript
- REST API
- JWT access tokens and refresh tokens
- Role-Based Access Control
- Prisma ORM
- Supabase PostgreSQL
- Supabase Storage for evidences/files
- Jest for existing tests unless the project explicitly changes test runner

## Module Boundaries

Organize backend work by modules under `src/modules` when the app grows beyond the starter shell:

- `auth`: login, refresh, logout, JWT validation, current user.
- `users`: internal users, technicians, advisors, admins, activation state.
- `roles`: roles, permissions, route access policies.
- `customers`: customer profile, search, vehicles, order history.
- `vehicles`: customer association, vehicle records, service history.
- `service-orders`: creation, status, technician assignment, history, closure.
- `diagnoses`: technical diagnosis, observations, required parts, evidence links.
- `quotes`: quote versions, items, totals, approval, rejection.
- `inventory`: products, categories, stock, movements, reservations, consumption, low-stock alerts.
- `repair-tasks`: assigned work, task status, technician updates.
- `evidences`: upload authorization, metadata, storage paths, order association.
- `reports`: dashboard metrics, order reports, inventory reports, quote reports.

Use `src/common` for shared guards, decorators, filters, interceptors, and pipes. Use `src/config` for environment and provider configuration.

## Business Rules

- A service order always belongs to one customer and one vehicle.
- Every service order status change must create status history with previous status, new status, user, timestamp, and optional comment.
- Delivered orders must not be modified unless an administrator allows it.
- A service order may have multiple quotes, but only one quote may be active or approved for the order.
- Approved quotes may reserve inventory products.
- Rejected quotes must not affect inventory.
- Every inventory consumption must create an inventory movement.
- Stock should not become negative unless an administrator explicitly allows it.
- Products used in an order must remain associated with that order.
- Reserved products must be releasable when an order is cancelled.
- Low-stock products must be reportable for alerts.
- Evidences must belong to a service order and may belong to an order stage.
- Evidence binary files must live outside the database. Store only URL, metadata, storage path, relation, uploader, and timestamps in PostgreSQL.

## Security And Audit

- Use DTO validation for every write endpoint.
- Sanitize and normalize inputs at module boundaries.
- Protect private endpoints with guards.
- Enforce role-based access for admin, manager, advisor, technician, and inventory manager workflows.
- Rate-limit or otherwise protect login endpoints when the dependency is available.
- Centralize error handling and avoid leaking secrets or internal stack details.
- Log important business actions such as status changes, quote approval, inventory movement, and evidence deletion.
- Keep audit data sufficient to answer who changed what and when.

## Prisma And Database

- Use Prisma Client for runtime database access from NestJS services.
- Configure Prisma datasource with `DATABASE_URL` as the runtime pooled connection.
- Configure `DIRECT_URL` for Prisma Migrate and administrative/direct operations.
- Do not hardcode database URLs, Supabase URLs, generated IDs, or secrets.
- Keep migrations and schema changes in this repo.
- Prefer explicit relations for customers, vehicles, service orders, status history, diagnoses, quotes, quote items, inventory products, inventory movements, repair tasks, evidences, comments, users, roles, and permissions.

## Supabase Boundaries

- Use Supabase PostgreSQL through Prisma for relational business data.
- Use Supabase Storage for evidence files such as reception, diagnosis, repair, delivery photos, and documents.
- The backend controls upload validation, authorization, storage path creation, and metadata persistence.
- The frontend must not write directly to Supabase Storage unless a future backend-controlled authorization flow explicitly allows it.
- Keep `SUPABASE_SERVICE_ROLE_KEY` backend-only.

## API Contract

- Swagger/OpenAPI is the contract source for the frontend.
- Document DTOs, validation constraints, enums, responses, errors, and auth requirements.
- Keep enums such as `ServiceOrderStatus`, `QuoteStatus`, `InventoryMovementType`, `UserRole`, `RepairTaskStatus`, and `ProductUnit` in the API contract.
- Prefer stable REST resource paths that match the TRD: auth, customers, vehicles, service-orders, quotes, inventory, evidences, reports.

## Testing And Verification

- Use existing project commands only; do not install packages unless explicitly asked.
- Available scripts include `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e`.
- Add focused tests for services that enforce inventory movements, quote approval/reservation, status transitions, guards, and evidence authorization.
- For docs-only or instruction-only changes, tests may be skipped with a clear note.
