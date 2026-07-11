# Temas para aprender — Implementación de endpoints de usuarios

Esta guía resume los conceptos de backend y NestJS que conviene estudiar a partir de la implementación de los endpoints bootstrap de usuarios.

## Ruta rápida

1. Entender el flujo HTTP: Controller → Service → Prisma → Database.
2. Estudiar DTOs y validación global antes de agregar más endpoints.
3. Revisar cómo se protege información sensible como `passwordHash`.
4. Entender por qué Swagger/OpenAPI se prueba como contrato, no solo se mira en navegador.

## Conceptos principales

| Tema | Qué aprender | Por qué importa |
| --- | --- | --- |
| Módulo de dominio | Cómo `UsersModule` agrupa controller, service, DTOs y tests. | Mantiene el código organizado por capacidad de negocio. |
| Controller | Define rutas HTTP como `POST /users` y delega al service. | Evita meter lógica de negocio en la capa HTTP. |
| Service | Contiene reglas de aplicación: crear usuario, buscar rol, hashear password, mapear respuestas. | Es donde vive la lógica real del caso de uso. |
| DTO | Define el contrato de entrada/salida de la API. | Protege al backend de cuerpos inválidos y documenta el contrato para Angular. |
| ValidationPipe | Valida DTOs automáticamente antes de llegar al service. | Convierte requests inválidos en `400 Bad Request`. |
| Password hashing | Convierte password plano en `passwordHash` con Argon2. | Nunca se guardan passwords en texto plano. |
| Response sanitization | Quita campos sensibles como `passwordHash` y `roleId` de la respuesta pública. | Evita filtrar datos internos o sensibles. |
| Prisma Client | Permite consultar y escribir en PostgreSQL con tipos TypeScript. | Centraliza acceso a datos desde NestJS. |
| Seed/bootstrap | Inserta roles base necesarios para crear usuarios. | `users.role_id` depende de que existan roles iniciales. |
| Swagger/OpenAPI | Documenta endpoints, DTOs, respuestas y errores esperados. | Es el contrato oficial que Angular va a consumir. |
| Contract testing | Prueba que OpenAPI documente lo que la API promete. | Evita que Swagger quede desactualizado respecto al backend. |
| HTTP errors | Traduce errores técnicos a respuestas claras: `400`, `404`, `409`, `503`. | Angular puede manejar errores de forma predecible. |
| Bootstrap-only endpoints | Endpoints temporales sin JWT para iniciar el sistema. | Sirven para avanzar, pero deben protegerse con Auth/RBAC antes de producción. |

## Flujo mental de `POST /users`

```txt
Request HTTP
  -> CreateUserDto + ValidationPipe
  -> UsersController
  -> UsersService
  -> buscar Role en Prisma
  -> hashear password
  -> crear User en Prisma
  -> mapear User a UserResponseDto
  -> Response HTTP sin passwordHash ni roleId
```

## Archivos clave para estudiar

| Archivo | Qué mirar |
| --- | --- |
| `src/modules/users/users.controller.ts` | Rutas HTTP y decoradores Swagger. |
| `src/modules/users/users.service.ts` | Lógica de creación, búsqueda, errores y sanitización. |
| `src/modules/users/dto/create-user.dto.ts` | Validaciones de entrada. |
| `src/modules/users/dto/user-response.dto.ts` | Contrato público de salida. |
| `src/common/security/password-hasher.service.ts` | Abstracción para hashing de passwords. |
| `prisma/seed.ts` | Bootstrap de roles iniciales. |
| `src/modules/users/users.service.spec.ts` | Tests de lógica de negocio. |
| `test/users.e2e-spec.ts` | Tests del contrato HTTP. |
| `src/modules/users/users.openapi.spec.ts` | Tests del contrato Swagger/OpenAPI. |
| `openspec/changes/complete-users-endpoints/` | Propuesta, spec, diseño y tareas SDD. |

## Checklist de aprendizaje

- [ ] Puedo explicar por qué `UsersController` no debe hashear passwords.
- [ ] Puedo explicar la diferencia entre `CreateUserDto` y `UserResponseDto`.
- [ ] Puedo explicar por qué `passwordHash` no debe salir en responses.
- [ ] Puedo explicar qué hace `ValidationPipe`.
- [ ] Puedo explicar por qué `roles` necesita seed antes de crear usuarios.
- [ ] Puedo leer un test unitario del service y entender qué regla protege.
- [ ] Puedo leer un e2e y entender qué contrato HTTP protege.
- [ ] Puedo explicar por qué los endpoints actuales son bootstrap-only.
- [ ] Puedo explicar qué falta antes de producción: Auth, JWT, Guards y RBAC.

## Próximo tema recomendado

El siguiente bloque natural es **Auth/RBAC**:

```txt
login -> JWT -> guards -> roles -> proteger /users
```

No conviene seguir creando endpoints administrativos sin entender primero cómo se van a proteger.
