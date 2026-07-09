# RacerLab API Claude Instructions

Follow `AGENTS.md` in this repository as the primary instruction source.

Critical reminders:

- This is the NestJS backend and business layer.
- Use TypeScript, REST, Prisma, Supabase PostgreSQL, and Supabase Storage.
- Keep modules aligned with auth, users, roles, customers, vehicles, service-orders, diagnoses, quotes, inventory, repair-tasks, evidences, and reports.
- Enforce service order status history, quote approval/reservation, inventory movements, role-based access, audit/security, and external evidence storage.
- Use `DATABASE_URL` for Prisma runtime and `DIRECT_URL` for migrations/admin operations.
- Supabase is only the DB/storage provider; never expose service role keys to the frontend.
- OpenAPI/Swagger is the contract source for the Angular frontend.
