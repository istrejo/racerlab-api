# RacerLab API

Backend foundation for a workshop-management platform built around traceable service operations, secure authentication, and a scalable domain model.

> **Project status:** Active development. Authentication, refresh-session rotation, RBAC, protected user management, API documentation, health checks, and the initial workshop domain schema are implemented. Business modules and workshop-based tenancy are being developed incrementally.

## Overview

RacerLab is a SaaS-oriented product for mechanical workshops. Its goal is to centralize the full operational flow—from customer and vehicle intake to diagnosis, quotation, repair, inventory usage, evidence, and delivery—without losing traceability between stages.

This repository contains the REST API and the backend business foundation. The Angular client lives in [`racerlab-web`](https://github.com/istrejo/racerlab-web).

## Implemented foundation

- JWT access-token authentication.
- Opaque refresh tokens transported through `HttpOnly` cookies.
- Refresh-token rotation with persisted, hashed sessions.
- Current-session logout and global logout across all active sessions.
- Password hashing with Argon2.
- Role-based access control using NestJS guards and decorators.
- Protected administration endpoints for creating, listing, reading, and updating users.
- Swagger/OpenAPI documentation with bearer authentication support.
- Global DTO validation with payload whitelisting.
- Configurable CORS and cookie behavior.
- Database health checks.
- Prisma migrations and seed support.

## Domain foundation

The current Prisma schema models the core workshop workflow:

- Users, roles, permissions, and authentication sessions.
- Customers and vehicles.
- Service orders, priorities, technicians, and status history.
- Diagnoses and quotations.
- Repair tasks.
- Inventory products, categories, and movements.
- Evidence and comments linked to the service lifecycle.

The schema is intentionally broader than the currently exposed HTTP modules. Domain endpoints are being implemented in vertical slices while the data model and authorization boundaries are refined.

## Authentication flow

1. `POST /api/auth/login` validates the user and returns a short-lived access token.
2. A long-lived opaque refresh token is stored in an `HttpOnly` cookie.
3. `POST /api/auth/refresh` rotates the refresh session and returns a new access token.
4. `POST /api/auth/logout` revokes the current refresh session.
5. `POST /api/auth/logout-all` revokes every active session for the authenticated user.

The frontend keeps the access token in memory and relies on the refresh cookie to restore the session after a page reload.

## Architecture

```text
src/
├── common/          # Shared guards, decorators, auth types, and cross-cutting utilities
├── config/          # Auth, CORS, and Swagger configuration
├── health/          # Application and database health checks
├── modules/
│   ├── auth/        # Login, refresh rotation, logout, and session lifecycle
│   └── users/       # Protected user administration
├── prisma/          # Prisma integration
└── testing/         # Shared testing safeguards and utilities

prisma/
├── migrations/
├── schema.prisma
└── seed.ts
```

The backend is kept separate from the web client so both applications can evolve, test, and deploy independently.

## Workshop tenancy roadmap

The next major architecture milestone is workshop-based tenancy:

- A global user identity can be associated with a workshop through a membership.
- Roles and permissions are evaluated from the active workshop membership instead of directly from the user.
- Operational records are scoped by `workshopId`.
- Workshop owners can invite employees through expiring, one-time invitation tokens.
- Authentication sessions remain bound to the active workshop context.

This section describes the target architecture and is not presented as completed functionality.

## Tech stack

| Area | Technology |
|---|---|
| Runtime | Node.js, TypeScript |
| Framework | NestJS 11 |
| API | REST, Swagger / OpenAPI |
| Database | PostgreSQL on Supabase |
| ORM | Prisma 6 |
| Authentication | Passport, JWT, HttpOnly cookies, Argon2 |
| Validation | class-validator, class-transformer |
| Testing | Jest, Supertest |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL or a Supabase project

### Installation

```bash
git clone https://github.com/istrejo/racerlab-api.git
cd racerlab-api
pnpm install
cp .env.example .env
```

Configure the database URLs and authentication values in `.env`, then generate the Prisma client and apply migrations:

```bash
pnpm prisma:generate
pnpm prisma:migrate:dev
```

Start the development server:

```bash
pnpm start:dev
```

The API is available under `http://localhost:3000/api` and Swagger UI under `http://localhost:3000/api/docs`.

## Useful commands

```bash
pnpm build                 # Compile the application
pnpm start:dev             # Run in watch mode
pnpm test                  # Run unit tests
pnpm test:e2e              # Run end-to-end tests
pnpm test:cov              # Generate coverage
pnpm prisma:studio         # Open Prisma Studio
pnpm prisma:migrate:dev    # Create/apply a development migration
```

## Related repository

- [RacerLab Web](https://github.com/istrejo/racerlab-web) — Angular client and authentication shell.

## Portfolio note

RacerLab is both a real product initiative and an engineering case study. It documents the transition from frontend-focused development into backend architecture, authentication, data modelling, API design, and multi-tenant SaaS decisions.

## License

This repository is currently unlicensed and shared for portfolio and evaluation purposes. No permission is granted for production reuse.
