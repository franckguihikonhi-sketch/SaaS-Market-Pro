-- ===========================================================================
-- Market-Pro — Schéma PostgreSQL (Supabase), Phase 1 : architecture & données.
--
-- Même procédé que les autres applications du dépôt (Boulange ERP,
-- Fish-Afric, PaieCI…) : le frontend appelle Supabase directement, la
-- rigueur métier (atomicité, idempotence, contrôle d'accès) est assurée
-- côté base via des fonctions SQL (RPC) et des policies Row Level Security,
-- pas par un serveur applicatif séparé.
--
-- Isolation multi-tenant : chaque Organization est un client SaaS
-- indépendant ; les lectures/écritures sont filtrées par organization_id
-- via my_organization_id() dans les policies RLS ci-dessous.
--
-- À exécuter en une fois dans Supabase → SQL Editor. Le bloc DROP ci-dessous
-- nettoie une éventuelle ancienne structure (ex. schéma Prisma de la V0 de
-- ce projet) pour repartir d'une base propre — sans danger sur un projet
-- neuf sans données réelles.
-- ===========================================================================

drop table if exists
  audit_logs, cash_movements, cash_sessions, cash_registers, customer_payments,
  customer_groups, inventory_lines, inventories, invoices, payments,
  price_list_items, price_lists, promotions, purchase_lines, purchases,
  return_lines, returns, sale_lines, sales, settings, supplier_payments,
  transfer_lines, transfers, unit_conversions, user_permissions,
  role_permissions, permissions, roles, stock_movements, stocks,
  product_units, products, units, brands, categories, customers, suppliers,
  warehouses, stores, users, organizations, profiles
cascade;

drop type if exists user_role cascade;
drop type if exists product_status cascade;
drop type if exists stock_movement_type cascade;
drop function if exists my_organization_id() cascade;
drop function if exists my_role() cascade;
drop function if exists health_check() cascade;

create type user_role as enum ('super_admin', 'admin', 'manager', 'cashier', 'warehouse_keeper', 'accountant');
create type product_status as enum ('active', 'inactive', 'archived');

-- ---------------------------------------------------------------------------
-- TENANCY & UTILISATEURS
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Profil applicatif lié à Supabase Auth : id = auth.users.id.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid not null references organizations on delete cascade,
  store_id uuid,
  full_name text not null,
  role user_role not null default 'cashier',
  created_at timestamptz not null default now()
);

create or replace function my_organization_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- MAGASINS & DÉPÔTS
-- ---------------------------------------------------------------------------

create table stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code text not null,
  name text not null,
  address text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table profiles add constraint profiles_store_id_fkey
  foreign key (store_id) references stores on delete set null;

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  store_id uuid references stores on delete set null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- ---------------------------------------------------------------------------
-- CATALOGUE : CATÉGORIES, MARQUES, UNITÉS, ARTICLES
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  parent_id uuid references categories on delete set null,
  name text not null
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  name text not null,
  unique (organization_id, name)
);

-- Palette d'unités (Carton, Pack, Bouteille, Kg, g, Litre, Pièce…).
create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code text not null,
  label text not null,
  unique (organization_id, code)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  category_id uuid references categories on delete set null,
  brand_id uuid references brands on delete set null,
  base_unit_id uuid not null references units on delete restrict,
  code text not null,
  barcode text,
  label text not null,
  purchase_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  min_stock numeric(18,6) not null default 0,
  status product_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index on products (organization_id, barcode);

-- Unités de vente/achat d'un article, avec coefficient vers l'unité de base
-- (ex. 1 Carton = 24 Bouteille). Le stock réel est toujours en unité de base.
create table product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  unit_id uuid not null references units on delete restrict,
  coefficient_to_base numeric(18,6) not null,
  is_base boolean not null default false,
  barcode text,
  unique (product_id, unit_id)
);

-- ---------------------------------------------------------------------------
-- TIERS : CLIENTS, FOURNISSEURS
-- ---------------------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code text not null,
  name text not null,
  phone text default '',
  email text default '',
  credit_limit numeric(14,2) not null default 0,
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code text not null,
  name text not null,
  phone text default '',
  email text default '',
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- ---------------------------------------------------------------------------
-- STOCK
-- ---------------------------------------------------------------------------

create table stocks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  warehouse_id uuid not null references warehouses on delete cascade,
  quantity numeric(18,6) not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

create type stock_movement_type as enum (
  'purchase_receipt', 'sale', 'adjustment', 'breakage', 'loss', 'theft',
  'supplier_return', 'customer_return', 'transfer_in', 'transfer_out', 'inventory_count'
);

-- Historique complet des mouvements (qui, quand, pourquoi, avant/après).
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  warehouse_id uuid not null references warehouses on delete cascade,
  author uuid references profiles,
  type stock_movement_type not null,
  quantity numeric(18,6) not null,
  previous_qty numeric(18,6) not null,
  new_qty numeric(18,6) not null,
  reason text default '',
  created_at timestamptz not null default now()
);
create index on stock_movements (product_id, warehouse_id, created_at);

-- ---------------------------------------------------------------------------
-- Vérification de connectivité (utilisée par la page d'accueil du frontend).
-- Ne touche aucune table protégée par RLS : accessible même anonymement.
create or replace function health_check() returns boolean
language sql stable as $$ select true; $$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY : isolation stricte par organisation.
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table stores enable row level security;
alter table warehouses enable row level security;
alter table categories enable row level security;
alter table brands enable row level security;
alter table units enable row level security;
alter table products enable row level security;
alter table product_units enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table stocks enable row level security;
alter table stock_movements enable row level security;

create policy "read own org" on organizations for select using (id = my_organization_id());
create policy "read own profile" on profiles for select using (organization_id = my_organization_id());

create policy "org read" on stores for select using (organization_id = my_organization_id());
create policy "org read" on warehouses for select using (organization_id = my_organization_id());
create policy "org read" on categories for select using (organization_id = my_organization_id());
create policy "org read" on brands for select using (organization_id = my_organization_id());
create policy "org read" on units for select using (organization_id = my_organization_id());
create policy "org read" on products for select using (organization_id = my_organization_id());
create policy "org read" on customers for select using (organization_id = my_organization_id());
create policy "org read" on suppliers for select using (organization_id = my_organization_id());

create policy "org read" on product_units for select using (
  exists (select 1 from products p where p.id = product_id and p.organization_id = my_organization_id())
);
create policy "org read" on stocks for select using (
  exists (select 1 from products p where p.id = product_id and p.organization_id = my_organization_id())
);
create policy "org read" on stock_movements for select using (
  exists (select 1 from products p where p.id = product_id and p.organization_id = my_organization_id())
);

-- Écritures : réservées aux rôles admin/manager de l'organisation
-- (affiné par table dans les phases suivantes, au fur et à mesure que
-- l'UI de gestion est construite).
create policy "admin write" on categories for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);
create policy "admin write" on brands for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);
create policy "admin write" on units for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);
create policy "admin write" on products for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);

-- Un admin peut modifier le rôle des collègues de son organisation
-- (jamais le sien, pour éviter de se retirer ses propres droits par erreur).
create policy "admin update profiles" on profiles for update using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'super_admin')
  and id <> auth.uid()
);

-- ─────────────────────────────────────────────────────────────────────────
-- PHASE 2 : PROVISIONING AUTOMATIQUE À L'INSCRIPTION
-- ─────────────────────────────────────────────────────────────────────────
-- Chaque inscription (supabase.auth.signUp) crée sa propre organisation et
-- devient automatiquement administrateur de celle-ci — modèle SaaS
-- self-serve standard. organization_name/full_name sont lus depuis les
-- métadonnées passées à signUp (options.data).

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_name text;
begin
  v_org_name := coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'), ''), 'Mon organisation');

  insert into organizations (name, slug)
  values (v_org_name, 'org-' || replace(new.id::text, '-', ''))
  returning id into v_org_id;

  insert into profiles (id, organization_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email),
    'admin'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- PHASE 3 : ARTICLES, UNITÉS ET STOCK
-- ─────────────────────────────────────────────────────────────────────────

create policy "admin write" on stores for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);
create policy "admin write" on warehouses for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);
create policy "admin write" on customers for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin', 'cashier')
);
create policy "admin write" on suppliers for all using (
  organization_id = my_organization_id() and my_role() in ('admin', 'manager', 'super_admin')
);
create policy "admin write" on product_units for all using (
  exists (select 1 from products p where p.id = product_id and p.organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin'))
);

-- Le stock lui-même ne s'écrit jamais directement : uniquement via
-- record_stock_movement() (security definer), pour garantir que quantity
-- reste toujours la somme exacte des mouvements. Pas de policy d'écriture
-- directe sur stocks/stock_movements — la RPC contourne RLS.

alter table stock_movements add column if not exists idempotency_key uuid unique;

create or replace function record_stock_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_type stock_movement_type,
  p_quantity numeric,
  p_reason text default '',
  p_idempotency_key uuid default gen_random_uuid()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_movement_id uuid;
  v_org uuid;
  v_previous numeric;
  v_new numeric;
  v_delta numeric;
begin
  select id into v_existing from stock_movements where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  if coalesce(my_role() in ('admin', 'manager', 'super_admin', 'warehouse_keeper'), false) is not true then
    raise exception 'Rôle non autorisé à modifier le stock';
  end if;

  select organization_id into v_org from products where id = p_product_id;
  if v_org is null or v_org is distinct from my_organization_id() then
    raise exception 'Article introuvable';
  end if;
  if not exists (
    select 1 from warehouses where id = p_warehouse_id and organization_id = my_organization_id()
  ) then
    raise exception 'Dépôt introuvable';
  end if;

  v_delta := case
    when p_type in ('purchase_receipt', 'customer_return', 'transfer_in', 'inventory_count') then p_quantity
    when p_type in ('sale', 'breakage', 'loss', 'theft', 'supplier_return', 'transfer_out') then -p_quantity
    else p_quantity
  end;

  insert into stocks (product_id, warehouse_id, quantity)
  values (p_product_id, p_warehouse_id, 0)
  on conflict (product_id, warehouse_id) do nothing;

  select quantity into v_previous from stocks
    where product_id = p_product_id and warehouse_id = p_warehouse_id for update;
  v_new := v_previous + v_delta;

  update stocks set quantity = v_new, updated_at = now()
    where product_id = p_product_id and warehouse_id = p_warehouse_id;

  insert into stock_movements (
    product_id, warehouse_id, author, type, quantity, previous_qty, new_qty, reason, idempotency_key
  ) values (
    p_product_id, p_warehouse_id, auth.uid(), p_type, v_delta, v_previous, v_new, coalesce(p_reason, ''), p_idempotency_key
  ) returning id into v_movement_id;

  return v_movement_id;
end;
$$;
