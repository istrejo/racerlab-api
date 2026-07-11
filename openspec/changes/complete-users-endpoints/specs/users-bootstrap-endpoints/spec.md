# Users Bootstrap Endpoints Specification

## Purpose

Define temporary bootstrap-only user create, list, and detail behavior for private setup before JWT/Auth/RBAC exists.

## Requirements

### Requirement: Bootstrap-only users access

The system SHALL expose `POST /users`, `GET /users`, and `GET /users/:id` as temporary bootstrap endpoints for private setup. The system MUST document that these endpoints are unauthenticated in this change and SHOULD be protected by JWT/Auth/RBAC in a future change.

#### Scenario: Temporary bootstrap access is disclosed

- GIVEN the API contract is reviewed
- WHEN a consumer reads the users endpoints
- THEN the contract identifies them as bootstrap-only and temporary
- AND the contract does not claim current JWT or RBAC protection

### Requirement: Request validation

The system MUST validate create-user payloads and user identifier parameters before executing users endpoint behavior.

#### Scenario: Valid create payload is accepted

- GIVEN a request body with name, unique email, password, and role
- WHEN `POST /users` is submitted
- THEN the request passes validation and reaches user creation

#### Scenario: Invalid payload or identifier is rejected

- GIVEN a malformed create body or non-UUID `:id`
- WHEN the request is submitted
- THEN the API returns `400 Bad Request`

### Requirement: Bootstrap roles availability

The system MUST provide bootstrap role records for every supported `UserRole` value required by user creation.

#### Scenario: Seeded roles support creation

- GIVEN the initial role bootstrap has run
- WHEN a create request uses a supported `UserRole`
- THEN the system resolves the role successfully

#### Scenario: Missing role bootstrap fails explicitly

- GIVEN the requested role record does not exist
- WHEN `POST /users` is submitted
- THEN the API returns `503 Service Unavailable`
- AND no user is created

### Requirement: Create user

The system MUST create users from `POST /users` using `name`, `email`, `password`, `role`, and optional `isActive`. The system MUST hash the submitted password before persistence and MUST reject duplicate emails.

#### Scenario: User is created with a hashed credential

- GIVEN a valid create request with a unique email
- WHEN `POST /users` succeeds
- THEN the user is stored with a hashed password and linked role
- AND the response returns the sanitized user resource

#### Scenario: Duplicate email is rejected

- GIVEN an existing user already has the requested email
- WHEN `POST /users` is submitted
- THEN the API returns `409 Conflict`

### Requirement: Read users

The system SHALL return sanitized user resources from `GET /users` and `GET /users/:id`.

#### Scenario: List users returns sanitized resources

- GIVEN one or more users exist
- WHEN `GET /users` is requested
- THEN the API returns a collection of sanitized user resources

#### Scenario: Missing user detail returns not found

- GIVEN no user exists for the requested id
- WHEN `GET /users/:id` is requested
- THEN the API returns `404 Not Found`

### Requirement: Sanitized users contract and documentation

The system MUST expose user responses with `id`, `name`, `email`, `role`, `isActive`, `createdAt`, and `updatedAt`. The system MUST NOT expose `passwordHash` in runtime responses or Swagger/OpenAPI schemas.

#### Scenario: Responses omit credential fields

- GIVEN any successful users response
- WHEN the payload or schema is inspected
- THEN `passwordHash` is absent
- AND `roleId` is not required by the public contract

#### Scenario: Swagger documents users endpoints

- GIVEN Swagger/OpenAPI is generated
- WHEN the users section is viewed
- THEN create, list, and detail operations and their success/error responses are documented
