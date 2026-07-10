# TRD — RacerLab API

Documento técnico del backend NestJS de RacerLab. Este repositorio contiene la API REST, la capa de negocio, Prisma, migraciones, conexión a Supabase PostgreSQL y control de Supabase Storage.

## 1. Objetivo técnico

Construir una API modular, segura y mantenible para la gestión de un taller mecánico.

El backend debe ser la fuente de verdad para reglas de negocio, autorización, contratos de API, auditoría, persistencia relacional y control de evidencias.

## 2. Stack backend

| Área | Decisión |
| --- | --- |
| Framework | NestJS |
| Lenguaje | TypeScript |
| API | REST |
| Auth | JWT access token + refresh token |
| Autorización | Role-Based Access Control |
| ORM | Prisma ORM |
| Base de datos | Supabase PostgreSQL |
| Storage | Supabase Storage para evidencias |
| Contrato | OpenAPI/Swagger |
| Package manager | pnpm |

NestJS es adecuado porque permite una arquitectura modular, clara y escalable para aplicaciones servidor en TypeScript.

## 3. Responsabilidad del repositorio

`racerlab-api` es responsable de:

- API REST NestJS.
- Autenticación y refresh token.
- Usuarios, roles y permisos.
- Reglas de negocio de órdenes, cotizaciones e inventario.
- Prisma schema, migraciones y seeds.
- Conexión a Supabase PostgreSQL.
- Integración con Supabase Storage.
- Swagger/OpenAPI como contrato oficial.
- Auditoría y logs de acciones importantes.

No es responsable de:

- Pantallas Angular.
- Estado visual del frontend.
- Componentes UI.
- Deploy del frontend.

## 4. Arquitectura de integración

Flujo técnico obligatorio:

```txt
Angular Web App
    -> NestJS REST API
        -> Prisma ORM
            -> Supabase PostgreSQL
        -> Supabase Storage
```

El backend seguirá siendo la capa principal de negocio. Supabase se usa como proveedor gestionado de PostgreSQL y Storage, no como reemplazo del backend.

## 5. Base de datos

Proveedor principal para el MVP:

```txt
Database Provider: Supabase
Database Engine: PostgreSQL
Database Access: Prisma ORM desde NestJS
Storage: Supabase Storage
```

La base debe ser relacional porque el sistema tiene relaciones fuertes entre clientes, vehículos, órdenes, cotizaciones, productos, movimientos de inventario, técnicos y usuarios internos.

## 6. Prisma ORM

Prisma debe conectarse a Supabase PostgreSQL usando variables de entorno:

```txt
DATABASE_URL=
DIRECT_URL=
```

Uso recomendado:

- `DATABASE_URL`: conexión principal usada por Prisma Client en runtime.
- `DIRECT_URL`: conexión directa usada por Prisma Migrate y operaciones administrativas.

Configuración esperada en `schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

## 7. Supabase

Supabase será utilizado como proveedor principal de base de datos y storage.

```txt
Supabase PostgreSQL -> Base de datos principal
Supabase Storage    -> Evidencias y archivos de órdenes
Supabase Dashboard  -> Administración visual de base de datos
```

Supabase hará:

- Proveer PostgreSQL gestionado.
- Almacenar datos relacionales del sistema.
- Almacenar imágenes y evidencias mediante Supabase Storage.
- Facilitar administración inicial desde dashboard.
- Reducir costos y mantenimiento de infraestructura durante el MVP.

Supabase no hará en el MVP:

- No reemplazará al backend NestJS.
- No será usado como capa principal de reglas de negocio.
- No se usará Supabase Auth como autenticación principal inicialmente.
- No permitirá que Angular escriba directamente datos críticos.

## 8. Estructura sugerida

```txt
racerlab-api/
  docs/
    trd.md
  src/
    common/
      decorators/
      guards/
      filters/
      interceptors/
      pipes/
    config/
    modules/
      auth/
      users/
      roles/
      customers/
      vehicles/
      service-orders/
      diagnoses/
      quotes/
      inventory/
      repair-tasks/
      evidences/
      reports/
    prisma/
    main.ts
  prisma/
    schema.prisma
    migrations/
    seed.ts
  docker-compose.yml
  package.json
  README.md
```

## 9. Módulos backend

### AuthModule

Responsable de:

- Login.
- Refresh token.
- Validación JWT.
- Logout.
- Protección de rutas.
- Recuperación de contraseña en fase futura.

### UsersModule

Responsable de:

- Usuarios internos.
- Técnicos.
- Asesores.
- Administradores.
- Activar/desactivar usuarios.

### RolesModule

Responsable de:

- Roles.
- Permisos.
- Control de acceso.

### CustomersModule

Responsable de:

- Clientes.
- Historial de órdenes.
- Búsqueda por teléfono, nombre, documento o email.

### VehiclesModule

Responsable de:

- Vehículos.
- Asociación con clientes.
- Historial de servicios.

### ServiceOrdersModule

Responsable de:

- Creación de órdenes.
- Estados.
- Asignación de técnico.
- Historial.
- Cierre de órdenes.

### DiagnosesModule

Responsable de:

- Diagnóstico técnico.
- Observaciones.
- Repuestos requeridos.
- Evidencias.

### QuotesModule

Responsable de:

- Cotizaciones.
- Ítems.
- Totales.
- Aprobación.
- Rechazo.
- Versiones de cotización.

### InventoryModule

Responsable de:

- Productos.
- Stock.
- Categorías.
- Movimientos.
- Reservas.
- Consumos.
- Alertas de stock bajo.

### EvidencesModule

Responsable de:

- Subida de imágenes.
- Asociación con órdenes.
- Asociación con etapas.
- Gestión de archivos.

### ReportsModule

Responsable de:

- Métricas operativas.
- Reportes de órdenes.
- Reportes de inventario.
- Reportes de cotizaciones.

## 10. Modelo de base de datos inicial

Tablas principales:

```txt
users
roles
permissions
customers
vehicles
service_orders
service_order_status_history
diagnoses
quotes
quote_items
inventory_products
inventory_categories
inventory_movements
repair_tasks
evidences
comments
```

## 11. Entidades principales

### User

```txt
id
name
email
password_hash
role_id
is_active
created_at
updated_at
```

### Customer

```txt
id
full_name
phone
whatsapp
email
document
address
notes
created_at
updated_at
```

### Vehicle

```txt
id
customer_id
plate
brand
model
year
color
vin
mileage
vehicle_type
notes
created_at
updated_at
```

### ServiceOrder

```txt
id
code
customer_id
vehicle_id
assigned_technician_id
status
priority
reported_issues
reception_notes
mileage_in
fuel_level
estimated_delivery_date
total_estimated
total_approved
total_final
created_by_id
created_at
updated_at
closed_at
```

### Quote

```txt
id
service_order_id
status
subtotal
discount
tax
total
approval_method
approved_at
rejected_at
created_by_id
created_at
updated_at
```

### QuoteItem

```txt
id
quote_id
inventory_product_id
type
description
quantity
unit_price
cost_price
total
is_approved
created_at
updated_at
```

### InventoryProduct

```txt
id
category_id
name
sku
brand
description
unit
cost_price
sale_price
current_stock
minimum_stock
location
is_active
created_at
updated_at
```

### InventoryMovement

```txt
id
product_id
service_order_id
type
quantity
previous_stock
new_stock
created_by_id
notes
created_at
```

### RepairTask

```txt
id
service_order_id
assigned_technician_id
title
description
status
started_at
completed_at
created_at
updated_at
```

### Evidence

```txt
id
service_order_id
uploaded_by_id
stage
file_url
file_type
description
created_at
```

## 12. Reglas de negocio técnicas

### Órdenes

- Una orden siempre debe pertenecer a un cliente y a un vehículo.
- Una orden puede tener uno o varios técnicos.
- Cada cambio de estado debe quedar registrado.
- Una orden entregada no debe poder modificarse sin permiso de administrador.

### Cotizaciones

- Una orden puede tener varias cotizaciones.
- Solo una cotización puede estar activa/aprobada para una orden.
- Una cotización aprobada puede reservar productos del inventario.
- Una cotización rechazada no debe afectar inventario.

### Inventario

- Todo producto debe tener unidad de medida.
- Todo consumo debe generar un movimiento de inventario.
- El stock no debería quedar negativo salvo que el administrador lo permita.
- Los productos usados en una orden deben quedar asociados a esa orden.
- Los productos reservados deben poder liberarse si la orden se cancela.
- Los productos por debajo del stock mínimo deben aparecer en alertas.

### Evidencias

- Toda evidencia debe pertenecer a una orden.
- Las imágenes deben guardarse fuera de la base de datos.
- La base de datos solo debe guardar URL, metadata y relación con la orden.

## 13. API REST sugerida

### Auth

```txt
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/me
```

### Customers

```txt
GET /customers
GET /customers/:id
POST /customers
PATCH /customers/:id
DELETE /customers/:id
```

### Vehicles

```txt
GET /vehicles
GET /vehicles/:id
POST /vehicles
PATCH /vehicles/:id
DELETE /vehicles/:id
GET /customers/:customerId/vehicles
```

### Service Orders

```txt
GET /service-orders
GET /service-orders/:id
POST /service-orders
PATCH /service-orders/:id
PATCH /service-orders/:id/status
POST /service-orders/:id/assign-technician
GET /service-orders/:id/history
```

### Quotes

```txt
GET /quotes
GET /quotes/:id
POST /service-orders/:orderId/quotes
PATCH /quotes/:id
POST /quotes/:id/approve
POST /quotes/:id/reject
```

### Inventory

```txt
GET /inventory/products
GET /inventory/products/:id
POST /inventory/products
PATCH /inventory/products/:id
DELETE /inventory/products/:id
POST /inventory/products/:id/movements
GET /inventory/movements
GET /inventory/low-stock
```

### Evidences

```txt
POST /service-orders/:orderId/evidences
GET /service-orders/:orderId/evidences
DELETE /evidences/:id
```

### Reports

```txt
GET /reports/dashboard
GET /reports/orders
GET /reports/inventory
GET /reports/quotes
```

## 14. Contrato OpenAPI/Swagger

El backend debe exponer Swagger/OpenAPI para documentar endpoints y mantener sincronizado el consumo desde `racerlab-web`.

El contrato debe definir:

```txt
DTOs
Validaciones
Enums
Responses
Errores esperados
Contratos de endpoints
Requisitos de autenticación
```

Enums críticos:

```txt
ServiceOrderStatus
QuoteStatus
InventoryMovementType
UserRole
RepairTaskStatus
ProductUnit
```

## 15. Autenticación y seguridad

### Autenticación

- JWT access token.
- Refresh token.
- Password hashing con bcrypt o argon2.
- Guards en NestJS.
- Logout con invalidación o rotación de refresh tokens.

### Roles iniciales

```txt
ADMIN
MANAGER
ADVISOR
TECHNICIAN
INVENTORY_MANAGER
```

### Seguridad mínima

- Validación de DTOs.
- Sanitización y normalización de inputs.
- Rate limiting en login cuando la dependencia esté disponible.
- Protección de endpoints privados.
- Manejo centralizado de errores.
- Logs de acciones importantes.
- Auditoría de cambios de estado.
- Nunca exponer secretos al frontend.

## 16. Manejo de archivos

Las fotos y documentos deben guardarse en storage externo. Para el MVP, la opción recomendada es Supabase Storage.

Estructura sugerida:

```txt
evidences/
  service-orders/
    {orderId}/
      reception/
      diagnosis/
      repair/
      delivery/
```

Ejemplo:

```txt
evidences/service-orders/ORD-000123/diagnosis/photo-001.jpg
```

El backend debe controlar:

- Autorización de subida.
- Validación de archivo.
- Definición del storage path.
- Escritura en Supabase Storage.
- Persistencia de URL, metadata y relación en PostgreSQL.
- Eliminación o bloqueo de acceso cuando corresponda.

## 17. Variables de entorno

```txt
DATABASE_URL=
DIRECT_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ACCESS_TOKEN_EXPIRES_IN=
REFRESH_TOKEN_EXPIRES_IN=

STORAGE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=

CORS_ORIGIN=
```

Notas:

- `DATABASE_URL` será usado por Prisma Client en runtime.
- `DIRECT_URL` será usado por Prisma Migrate y operaciones administrativas.
- `SUPABASE_SERVICE_ROLE_KEY` solo debe vivir en el backend.
- `SUPABASE_STORAGE_BUCKET` puede ser `evidences`.
- `CORS_ORIGIN` debe permitir el dominio del frontend.

## 18. Testing backend

Pruebas recomendadas:

- Unit tests con Jest o Vitest, según configuración del proyecto.
- Tests de servicios principales.
- Tests de reglas de inventario.
- Tests de aprobación de cotizaciones.
- Tests de cambios de estado.
- Tests de guards y autorización.
- Tests de autorización de evidencias.

Flujos E2E prioritarios:

```txt
Crear cliente
Crear vehículo
Crear orden
Generar cotización
Aprobar cotización
Consumir inventario
Cerrar orden
```

## 19. Entorno local

El backend será responsable de conectarse a Supabase PostgreSQL mediante Prisma.

Para el MVP se recomienda usar Supabase como base de datos remota incluso en desarrollo, porque simplifica el setup inicial y permite trabajar con una base gestionada desde el primer día.

Opcionalmente, se puede mantener Docker Compose para PostgreSQL local si se requiere trabajar sin conexión o hacer pruebas aisladas.

Estructura local sugerida:

```txt
racerlab-api/
  .env
  .env.example
  prisma/
    schema.prisma
    migrations/
    seed.ts
  docs/
    trd.md
  docker-compose.yml # opcional para PostgreSQL local
```

Comandos sugeridos:

```bash
cd racerlab-api
pnpm install
pnpm prisma:migrate
pnpm prisma:generate
pnpm start:dev
```

Ambientes de base de datos recomendados:

```txt
Development: Supabase PostgreSQL development project
Staging: Supabase PostgreSQL staging project
Production: Supabase PostgreSQL production project
```

## 20. Deploy recomendado

Opciones recomendadas:

- Render.
- Railway.
- Fly.io.
- VPS con Docker.

El backend debe conectarse a PostgreSQL mediante `DATABASE_URL` y configurar CORS para permitir el dominio del frontend.

## 21. Estrategia de desarrollo backend

### Fase 1 — Base del sistema

- Configurar NestJS API.
- Crear proyecto en Supabase.
- Configurar Supabase PostgreSQL.
- Configurar Prisma con `DATABASE_URL` y `DIRECT_URL`.
- Configurar Supabase Storage para evidencias.
- Configurar Swagger/OpenAPI.
- Configurar Auth.
- Configurar roles.
- Configurar comunicación local con frontend.

### Fase 2 — Operación principal

- Clientes.
- Vehículos.
- Órdenes de servicio.
- Estados.
- Técnicos.
- Dashboard básico.

### Fase 3 — Cotización e inventario

- Productos.
- Categorías.
- Stock.
- Movimientos.
- Cotizaciones.
- Asociación de productos a cotización.
- Reserva/consumo de inventario.

### Fase 4 — Reparación y evidencias

- Tareas.
- Comentarios.
- Fotos.
- Control de calidad.
- Cierre de orden.

### Fase 5 — Reportes

- Reporte de órdenes.
- Reporte de inventario.
- Reporte de cotizaciones.
- Métricas del dashboard.

## 22. Recomendación técnica final

Stack recomendado para el MVP backend:

```txt
Backend Repository: racerlab-api
Backend: NestJS + TypeScript
Database Provider: Supabase
Database Engine: PostgreSQL
ORM: Prisma
Auth: JWT + Refresh Token
Storage: Supabase Storage
API Contract: OpenAPI / Swagger
Testing: Jest o Vitest
Deploy: Railway / Render / Fly.io / VPS
Package Manager: pnpm
Architecture: Repositorio separado
```

La regla principal de coordinación es que el backend mantiene actualizado Swagger/OpenAPI para evitar inconsistencias con `racerlab-web`.
