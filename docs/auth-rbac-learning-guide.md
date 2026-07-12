# Temas para aprender — Implementación de Auth/RBAC

Esta guía resume los conceptos de backend y NestJS que conviene estudiar a partir de la implementación de autenticación, JWT y autorización por roles para proteger los endpoints de usuarios.

## Ruta rápida

1. Entender la diferencia entre autenticación y autorización.
2. Seguir el flujo: `POST /auth/login` → JWT → `JwtStrategy` → guards → endpoint protegido.
3. Revisar por qué el backend recarga el usuario activo desde Prisma en cada request protegido.
4. Estudiar cómo Swagger/OpenAPI documenta seguridad Bearer como parte del contrato.
5. Leer los tests e2e para ver las diferencias entre `401 Unauthorized` y `403 Forbidden`.

## Conceptos principales

| Tema | Qué aprender | Por qué importa |
| --- | --- | --- |
| Autenticación | Confirmar quién es el usuario mediante email/password. | Sin identidad confiable, cualquier autorización posterior es falsa. |
| Autorización | Decidir qué puede hacer un usuario autenticado. | Protege operaciones administrativas como crear o editar usuarios. |
| Argon2 verify | Comparar un password plano contra un hash almacenado. | El backend nunca debe guardar ni comparar passwords en texto plano. |
| JWT access token | Token firmado que representa una sesión de corta duración. | Permite autenticar requests sin consultar credenciales en cada endpoint. |
| Claims JWT | Datos como `sub` que identifican al usuario dentro del token. | Los claims deben validarse en runtime; TypeScript no valida datos externos. |
| TTL de token | Tiempo de expiración del access token. | Evita tokens válidos indefinidamente y reduce impacto si se filtran. |
| Config fail-fast | Validar `JWT_SECRET` y `JWT_ACCESS_TOKEN_TTL` al iniciar. | Es mejor fallar al arrancar que emitir tokens inseguros o inválidos. |
| `JwtStrategy` | Valida el token y recarga el usuario actual desde Prisma. | Evita confiar en roles viejos si el usuario fue desactivado o cambiado. |
| `JwtAuthGuard` | Bloquea requests sin JWT válido. | Convierte endpoints públicos en endpoints autenticados. |
| `RolesGuard` | Verifica si el usuario autenticado tiene el rol requerido. | Separa “está logueado” de “tiene permiso”. |
| `@Roles(...)` | Metadata declarativa para indicar roles permitidos. | Hace visible la política de acceso en el controller. |
| `@CurrentUser()` | Decorator para leer `request.user` en handlers futuros. | Evita acoplar controllers a detalles internos de Passport/Nest. |
| Swagger Bearer Auth | Documenta que una operación requiere token Bearer. | Angular puede consumir el contrato sabiendo qué endpoints necesitan auth. |
| `401` vs `403` | `401` = no autenticado; `403` = autenticado pero sin permisos. | El frontend puede mostrar mensajes y flujos correctos. |
| Focused-test guard | Bloquea `it.only`, `test.only`, `fit`, `fdescribe`, etc. | Evita que CI pase por accidente con una suite parcial. |

## Flujo mental de login

```txt
POST /auth/login
  -> LoginDto + ValidationPipe
  -> AuthController
  -> AuthService
  -> normalizar email
  -> buscar usuario activo en Prisma
  -> verificar password con Argon2
  -> firmar JWT access token
  -> responder accessToken sin refresh token
```

## Flujo mental de endpoint protegido

```txt
Request con Authorization: Bearer <token>
  -> JwtAuthGuard
  -> JwtStrategy
  -> validar payload.sub
  -> recargar usuario activo desde Prisma
  -> RolesGuard
  -> validar @Roles(UserRole.ADMIN)
  -> UsersController
```

## Decisiones importantes de esta implementación

| Decisión | Motivo |
| --- | --- |
| Access token primero; refresh token después. | Reduce el tamaño del primer cambio y separa autenticación básica de ciclo de sesión. |
| Recargar usuario desde Prisma en `JwtStrategy`. | El rol o estado activo puede cambiar después de emitir el token. |
| Usuarios protegidos como `ADMIN` solamente. | Es la política más segura para endpoints administrativos de usuarios. |
| No usar permisos de tabla todavía. | `RolePermission` existe en el modelo, pero este slice usa RBAC simple por enum. |
| No implementar `/auth/me` todavía. | Pertenece a un slice posterior junto con sesión/refresh/logout. |
| No usar `@CurrentUser()` en `UsersController` todavía. | Los handlers actuales no necesitan leer el usuario; el decorator queda listo para casos futuros. |

## Archivos clave para estudiar

| Archivo | Qué mirar |
| --- | --- |
| `src/modules/auth/auth.controller.ts` | Endpoint `POST /auth/login` y documentación Swagger. |
| `src/modules/auth/auth.service.ts` | Verificación de credenciales, manejo de errores y firma del token. |
| `src/modules/auth/jwt.strategy.ts` | Validación de JWT y recarga del usuario activo desde Prisma. |
| `src/modules/auth/dto/login.dto.ts` | Contrato de entrada del login. |
| `src/modules/auth/dto/login-response.dto.ts` | Contrato público de salida del login. |
| `src/config/auth.config.ts` | Validación de secreto JWT y TTL. |
| `src/common/guards/jwt-auth.guard.ts` | Guard de autenticación JWT. |
| `src/common/guards/roles.guard.ts` | Guard de autorización por roles. |
| `src/common/decorators/roles.decorator.ts` | Metadata declarativa de roles permitidos. |
| `src/common/decorators/current-user.decorator.ts` | Acceso tipado al usuario autenticado. |
| `src/modules/users/users.controller.ts` | Protección ADMIN de endpoints `/users`. |
| `src/config/swagger.config.ts` | Esquema Bearer global en OpenAPI. |
| `test/auth.e2e-spec.ts` | Contrato HTTP del login. |
| `test/users.e2e-spec.ts` | Contrato HTTP de `401`, `403` y acceso ADMIN. |
| `src/modules/users/users.openapi.spec.ts` | Contrato Swagger de endpoints protegidos. |
| `src/testing/focused-test-guard.ts` | Protección contra tests enfocados accidentalmente. |

## Checklist de aprendizaje

- [ ] Puedo explicar por qué login devuelve `401` sin revelar si falló email, password o estado activo.
- [ ] Puedo explicar por qué un JWT firmado no alcanza: igual se recarga el usuario desde base de datos.
- [ ] Puedo explicar por qué `sub` debe validarse en runtime antes de llamar a Prisma.
- [ ] Puedo explicar la diferencia entre `JwtAuthGuard` y `RolesGuard`.
- [ ] Puedo explicar por qué `/users` usa `@Roles(UserRole.ADMIN)`.
- [ ] Puedo distinguir cuándo corresponde `401` y cuándo `403`.
- [ ] Puedo leer un test e2e y reconocer el flujo anónimo, no-ADMIN y ADMIN.
- [ ] Puedo explicar por qué Swagger Bearer Auth es parte del contrato, no decoración visual.
- [ ] Puedo explicar por qué refresh tokens no pertenecían a este primer slice.

## Próximos temas recomendados

| Tema | Objetivo |
| --- | --- |
| Refresh tokens | Aprender rotación, expiración larga, revocación y logout. |
| `/auth/me` | Exponer el usuario actual de forma segura. |
| Permissions RBAC | Pasar de roles enum a permisos por tabla cuando el dominio lo necesite. |
| Auditoría | Registrar quién cambió qué y cuándo en acciones administrativas. |
| Rate limiting de login | Reducir ataques de fuerza bruta contra credenciales. |

## Ejercicio recomendado

Explicar en voz alta este flujo sin mirar el código:

```txt
Usuario ADMIN hace GET /users
  -> envía Bearer token
  -> JwtStrategy valida token y recarga usuario activo
  -> RolesGuard confirma UserRole.ADMIN
  -> UsersController delega a UsersService
  -> la respuesta sale sin passwordHash ni roleId
```

Si se puede explicar ese flujo, la base conceptual de Auth/RBAC está bien encaminada.
