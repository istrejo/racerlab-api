-- PostgreSQL requires a newly added enum value to be committed before it is used.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'OWNER' BEFORE 'ADMIN';
