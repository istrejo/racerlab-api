do $$
begin
  if exists (select 1 from public.customers)
    or exists (select 1 from public.vehicles)
    or exists (select 1 from public.service_orders)
    or exists (select 1 from public.service_order_technicians)
    or exists (select 1 from public.service_order_status_history)
    or exists (select 1 from public.diagnoses)
    or exists (select 1 from public.quotes)
    or exists (select 1 from public.quote_items)
    or exists (select 1 from public.inventory_categories)
    or exists (select 1 from public.inventory_products)
    or exists (select 1 from public.inventory_movements)
    or exists (select 1 from public.repair_tasks)
    or exists (select 1 from public.evidences)
    or exists (select 1 from public.comments)
  then
    raise exception 'Controlled reset required before workshop tenancy migration when legacy workshop-owned rows exist.';
  end if;
end $$;

alter type public.user_role add value if not exists 'OWNER';

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshops_owner_user_id_key unique (owner_user_id),
  constraint workshops_owner_user_id_fkey foreign key (owner_user_id) references public.users(id)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workshop_id uuid not null,
  role_id uuid not null,
  is_active boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  constraint memberships_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade,
  constraint memberships_role_id_fkey foreign key (role_id) references public.roles(id)
);

alter table public.memberships
  add constraint membership_user_workshop_unique unique (user_id, workshop_id);

alter table public.memberships
  add constraint membership_id_user_unique unique (id, user_id);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_workshop_id_idx on public.memberships (workshop_id);
create index memberships_role_id_idx on public.memberships (role_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  email text not null,
  role_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  issued_by_user_id uuid not null,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_token_hash_key unique (token_hash),
  constraint invitation_workshop_email_unique unique (workshop_id, email),
  constraint invitations_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade,
  constraint invitations_role_id_fkey foreign key (role_id) references public.roles(id),
  constraint invitations_issued_by_user_id_fkey foreign key (issued_by_user_id) references public.users(id),
  constraint invitations_accepted_by_user_id_fkey foreign key (accepted_by_user_id) references public.users(id)
);

create index invitations_role_id_idx on public.invitations (role_id);
create index invitations_issued_by_user_id_idx on public.invitations (issued_by_user_id);
create index invitations_accepted_by_user_id_idx on public.invitations (accepted_by_user_id);
create index invitations_expires_at_idx on public.invitations (expires_at);

create table if not exists public.auth_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_selections_token_hash_key unique (token_hash),
  constraint auth_selections_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

create index auth_selections_user_id_idx on public.auth_selections (user_id);
create index auth_selections_expires_at_idx on public.auth_selections (expires_at);

alter table public.auth_sessions
  add column if not exists membership_id uuid;

alter table public.auth_sessions
  add constraint auth_session_membership_user_fk
  foreign key (membership_id, user_id) references public.memberships(id, user_id);

create index auth_sessions_membership_id_idx on public.auth_sessions (membership_id);

alter table public.customers add column if not exists workshop_id uuid;
alter table public.vehicles add column if not exists workshop_id uuid;
alter table public.service_orders add column if not exists workshop_id uuid;
alter table public.service_order_technicians add column if not exists workshop_id uuid;
alter table public.service_order_status_history add column if not exists workshop_id uuid;
alter table public.diagnoses add column if not exists workshop_id uuid;
alter table public.quotes add column if not exists workshop_id uuid;
alter table public.quote_items add column if not exists workshop_id uuid;
alter table public.inventory_categories add column if not exists workshop_id uuid;
alter table public.inventory_products add column if not exists workshop_id uuid;
alter table public.inventory_movements add column if not exists workshop_id uuid;
alter table public.repair_tasks add column if not exists workshop_id uuid;
alter table public.evidences add column if not exists workshop_id uuid;
alter table public.comments add column if not exists workshop_id uuid;

alter table public.customers alter column workshop_id set not null;
alter table public.vehicles alter column workshop_id set not null;
alter table public.service_orders alter column workshop_id set not null;
alter table public.service_order_technicians alter column workshop_id set not null;
alter table public.service_order_status_history alter column workshop_id set not null;
alter table public.diagnoses alter column workshop_id set not null;
alter table public.quotes alter column workshop_id set not null;
alter table public.quote_items alter column workshop_id set not null;
alter table public.inventory_categories alter column workshop_id set not null;
alter table public.inventory_products alter column workshop_id set not null;
alter table public.inventory_movements alter column workshop_id set not null;
alter table public.repair_tasks alter column workshop_id set not null;
alter table public.evidences alter column workshop_id set not null;
alter table public.comments alter column workshop_id set not null;

alter table public.customers
  add constraint customers_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.vehicles
  add constraint vehicles_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.service_orders
  add constraint service_orders_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.service_order_technicians
  add constraint service_order_technicians_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.service_order_status_history
  add constraint service_order_status_history_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.diagnoses
  add constraint diagnoses_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.quotes
  add constraint quotes_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.quote_items
  add constraint quote_items_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.inventory_categories
  add constraint inventory_categories_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.inventory_products
  add constraint inventory_products_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.inventory_movements
  add constraint inventory_movements_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.repair_tasks
  add constraint repair_tasks_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.evidences
  add constraint evidences_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;
alter table public.comments
  add constraint comments_workshop_id_fkey foreign key (workshop_id) references public.workshops(id) on delete cascade;

alter table public.customers
  add constraint customer_id_workshop_unique unique (id, workshop_id);
alter table public.vehicles
  add constraint vehicle_id_workshop_unique unique (id, workshop_id);
alter table public.service_orders
  add constraint service_order_id_workshop_unique unique (id, workshop_id);
alter table public.inventory_products
  add constraint inventory_product_id_workshop_unique unique (id, workshop_id);
alter table public.inventory_categories
  add constraint inventory_category_id_workshop_unique unique (id, workshop_id);
alter table public.quotes
  add constraint quotes_id_workshop_unique unique (id, workshop_id);

alter table public.vehicles drop constraint if exists vehicles_plate_key;
alter table public.service_orders drop constraint if exists service_orders_code_key;
alter table public.inventory_categories drop constraint if exists inventory_categories_name_key;
alter table public.inventory_products drop constraint if exists inventory_products_sku_key;

alter table public.vehicles
  add constraint vehicles_workshop_id_plate_key unique (workshop_id, plate);
alter table public.service_orders
  add constraint service_orders_workshop_id_code_key unique (workshop_id, code);
alter table public.inventory_categories
  add constraint inventory_categories_workshop_id_name_key unique (workshop_id, name);
alter table public.inventory_products
  add constraint inventory_products_workshop_id_sku_key unique (workshop_id, sku);

alter table public.vehicles
  add constraint vehicles_customer_workshop_fk
  foreign key (customer_id, workshop_id) references public.customers(id, workshop_id);
alter table public.service_orders
  add constraint service_orders_customer_workshop_fk
  foreign key (customer_id, workshop_id) references public.customers(id, workshop_id);
alter table public.service_orders
  add constraint service_orders_vehicle_workshop_fk
  foreign key (vehicle_id, workshop_id) references public.vehicles(id, workshop_id);
alter table public.service_order_technicians
  add constraint service_order_technicians_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;
alter table public.service_order_status_history
  add constraint service_order_status_history_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;
alter table public.diagnoses
  add constraint diagnoses_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;
alter table public.quotes
  add constraint quotes_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;
alter table public.quote_items
  add constraint quote_items_quote_workshop_fk
  foreign key (quote_id, workshop_id) references public.quotes(id, workshop_id) on delete cascade;
alter table public.quote_items
  add constraint quote_items_product_workshop_fk
  foreign key (inventory_product_id, workshop_id) references public.inventory_products(id, workshop_id);
alter table public.inventory_products
  add constraint inventory_products_category_workshop_fk
  foreign key (category_id, workshop_id) references public.inventory_categories(id, workshop_id);
alter table public.inventory_movements
  add constraint inventory_movements_product_workshop_fk
  foreign key (product_id, workshop_id) references public.inventory_products(id, workshop_id);
alter table public.inventory_movements
  add constraint inventory_movements_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id);
alter table public.repair_tasks
  add constraint repair_tasks_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;
alter table public.evidences
  add constraint evidences_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;
alter table public.comments
  add constraint comments_order_workshop_fk
  foreign key (service_order_id, workshop_id) references public.service_orders(id, workshop_id) on delete cascade;

create index customers_workshop_id_idx on public.customers (workshop_id);
create index vehicles_workshop_id_idx on public.vehicles (workshop_id);
create index service_orders_workshop_id_idx on public.service_orders (workshop_id);
create index service_order_technicians_workshop_id_idx on public.service_order_technicians (workshop_id);
create index service_order_status_history_workshop_id_idx on public.service_order_status_history (workshop_id);
create index diagnoses_workshop_id_idx on public.diagnoses (workshop_id);
create index quotes_workshop_id_idx on public.quotes (workshop_id);
create index quote_items_workshop_id_idx on public.quote_items (workshop_id);
create index inventory_categories_workshop_id_idx on public.inventory_categories (workshop_id);
create index inventory_products_workshop_id_idx on public.inventory_products (workshop_id);
create index inventory_movements_workshop_id_idx on public.inventory_movements (workshop_id);
create index repair_tasks_workshop_id_idx on public.repair_tasks (workshop_id);
create index evidences_workshop_id_idx on public.evidences (workshop_id);
create index comments_workshop_id_idx on public.comments (workshop_id);

create or replace function public.enforce_workshop_owner_membership()
returns trigger
language plpgsql
as $$
declare
  owner_membership_count integer;
begin
  if tg_table_name = 'workshops' then
    select count(*)
      into owner_membership_count
      from public.memberships memberships
      join public.roles roles on roles.id = memberships.role_id
     where memberships.workshop_id = coalesce(new.id, old.id)
       and memberships.user_id = coalesce(new.owner_user_id, old.owner_user_id)
       and memberships.is_active = true
       and memberships.revoked_at is null
       and roles.name = 'OWNER';

    if owner_membership_count <> 1 then
      raise exception 'Each workshop must keep exactly one active OWNER membership matching owner_user_id.';
    end if;
  elsif tg_table_name = 'memberships' then
    select count(*)
      into owner_membership_count
      from public.memberships memberships
      join public.roles roles on roles.id = memberships.role_id
      join public.workshops workshops on workshops.id = memberships.workshop_id
     where workshops.id = coalesce(new.workshop_id, old.workshop_id)
       and workshops.owner_user_id = memberships.user_id
       and memberships.is_active = true
       and memberships.revoked_at is null
       and roles.name = 'OWNER';

    if owner_membership_count <> 1 then
      raise exception 'Each workshop must keep exactly one active OWNER membership matching owner_user_id.';
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists workshop_owner_membership_enforcer on public.workshops;
create constraint trigger workshop_owner_membership_enforcer
after insert or update on public.workshops
deferrable initially deferred
for each row
execute function public.enforce_workshop_owner_membership();

drop trigger if exists workshop_owner_membership_enforcer_on_memberships on public.memberships;
create constraint trigger workshop_owner_membership_enforcer_on_memberships
after insert or update or delete on public.memberships
deferrable initially deferred
for each row
execute function public.enforce_workshop_owner_membership();
