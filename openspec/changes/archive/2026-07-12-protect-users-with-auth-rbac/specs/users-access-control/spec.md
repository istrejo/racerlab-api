# Users Access Control Specification

## Purpose

Define authorization and API-contract rules for current users endpoints.

## Requirements

### Requirement: ADMIN-Only Users Endpoints

The system MUST require a valid JWT for `POST /users`, `GET /users`, `GET /users/:id`, and `PATCH /users/:id`. The system MUST authorize only `ADMIN` users for these routes in this slice and MUST return an authentication or authorization failure for every anonymous or non-`ADMIN` caller.

#### Scenario: Allow an authenticated ADMIN request

- GIVEN the caller is authenticated and currently has the `ADMIN` role
- WHEN the caller accesses any users endpoint
- THEN the request is authorized

#### Scenario: Block anonymous or non-ADMIN access

- GIVEN the caller is anonymous or authenticated with a non-`ADMIN` role
- WHEN the caller accesses any users endpoint
- THEN the request is denied

### Requirement: Swagger Bearer Contract

The system MUST publish Swagger/OpenAPI with Bearer authentication for protected users endpoints and keep `POST /auth/login` documented as the token-issuance entry point for this slice.

#### Scenario: Protected users route is documented with Bearer auth

- GIVEN the generated OpenAPI document
- WHEN a protected users operation is inspected
- THEN the operation declares Bearer authentication

#### Scenario: Login route remains the public auth entry point

- GIVEN the generated OpenAPI document
- WHEN `POST /auth/login` is inspected
- THEN it is documented without requiring Bearer authentication
