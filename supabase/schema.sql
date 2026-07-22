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
  email text,
  last_seen timestamptz,
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

-- Invitations : un admin invite un collègue à rejoindre SON organisation
-- avec un rôle donné, via un code d'invitation (voir handle_new_user).
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code text not null unique,
  role user_role not null default 'cashier',
  full_name text not null default '',
  created_by uuid references profiles on delete set null,
  used_by uuid references profiles on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Demandes de réinitialisation de mot de passe déposées par un salarié et
-- traitées par l'administrateur (voir request_password_reset).
create table password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  profile_id uuid references profiles on delete cascade,
  email text not null,
  full_name text not null default '',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Historique des connexions (renseigné via record_login après chaque login).
create table login_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  full_name text not null default '',
  role user_role not null default 'cashier',
  logged_in_at timestamptz not null default now()
);

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
alter table invitations enable row level security;
alter table password_reset_requests enable row level security;
alter table login_events enable row level security;
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

-- Les admins / managers gèrent les invitations de leur organisation.
create policy "org manage invitations" on invitations for all
  using (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  )
  with check (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  );

create policy "org manage reset requests" on password_reset_requests for all
  using (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  )
  with check (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  );

create policy "org read login events" on login_events for select
  using (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- PHASE 2 : PROVISIONING AUTOMATIQUE À L'INSCRIPTION
-- ─────────────────────────────────────────────────────────────────────────
-- Chaque inscription (supabase.auth.signUp) crée sa propre organisation et
-- devient automatiquement administrateur de celle-ci — modèle SaaS
-- self-serve standard. organization_name/full_name sont lus depuis les
-- métadonnées passées à signUp (options.data).

-- Génère une invitation (code aléatoire) pour l'organisation de l'appelant.
create or replace function create_invitation(p_role user_role, p_full_name text default '')
returns invitations
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := my_organization_id();
  v_role user_role := my_role();
  v_code text;
  v_row invitations;
begin
  if v_org is null or v_role not in ('admin', 'manager', 'super_admin') then
    raise exception 'Seul un administrateur peut inviter un membre.';
  end if;
  if p_role = 'super_admin' then
    raise exception 'Rôle non autorisé pour une invitation.';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from invitations where code = v_code);
  end loop;
  insert into invitations (organization_id, code, role, full_name, created_by)
  values (v_org, v_code, p_role, coalesce(nullif(trim(p_full_name), ''), ''), auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- Vérifie un code d'invitation (appel public depuis la page d'inscription).
create or replace function invitation_info(p_code text)
returns table (organization_name text, role user_role)
language sql security definer set search_path = public as $$
  select o.name, i.role
  from invitations i
  join organizations o on o.id = i.organization_id
  where i.code = upper(trim(p_code)) and i.used_by is null
  limit 1;
$$;

grant execute on function invitation_info(text) to anon, authenticated;
grant execute on function create_invitation(user_role, text) to authenticated;

-- Demande de réinitialisation depuis la page « Mot de passe oublié ».
create or replace function request_password_reset(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  select * into v_p from profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_p.id is null then
    return 'unknown';
  end if;
  if v_p.role in ('admin', 'super_admin') then
    return 'self';
  end if;
  if not exists (
    select 1 from password_reset_requests
    where profile_id = v_p.id and resolved_at is null
  ) then
    insert into password_reset_requests (organization_id, profile_id, email, full_name)
    values (v_p.organization_id, v_p.id, v_p.email, v_p.full_name);
  end if;
  return 'employee';
end;
$$;

grant execute on function request_password_reset(text) to anon, authenticated;

-- Enregistre la connexion de l'utilisateur courant (appelé après login).
create or replace function record_login()
returns void language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  select * into v_p from profiles where id = auth.uid();
  if v_p.id is null then return; end if;
  insert into login_events (organization_id, profile_id, full_name, role)
  values (v_p.organization_id, v_p.id, v_p.full_name, v_p.role);
end;
$$;

grant execute on function record_login() to authenticated;

-- ─── Console plateforme (multi-entreprises), réservée au super_admin ───────
create or replace function touch_last_seen()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_seen = now() where id = auth.uid();
end;
$$;
grant execute on function touch_last_seen() to authenticated;

create or replace function platform_overview()
returns table (
  organization_id uuid,
  organization_name text,
  created_at timestamptz,
  user_count bigint,
  active_count bigint,
  last_activity timestamptz
)
language sql security definer set search_path = public as $$
  select o.id, o.name, o.created_at,
    count(p.id) as user_count,
    count(p.id) filter (where p.last_seen > now() - interval '5 minutes') as active_count,
    max(p.last_seen) as last_activity
  from organizations o
  left join profiles p on p.organization_id = o.id
  where my_role() = 'super_admin'
  group by o.id, o.name, o.created_at
  order by o.name;
$$;
grant execute on function platform_overview() to authenticated;

create or replace function platform_agents()
returns table (
  organization_name text,
  full_name text,
  role user_role,
  last_seen timestamptz
)
language sql security definer set search_path = public as $$
  select o.name, p.full_name, p.role, p.last_seen
  from profiles p
  join organizations o on o.id = p.organization_id
  where my_role() = 'super_admin'
    and p.last_seen > now() - interval '5 minutes'
  order by o.name, p.full_name;
$$;
grant execute on function platform_agents() to authenticated;

-- Provisioning à l'inscription. Avec un invite_code valide → rejoint
-- l'organisation invitante et son rôle ; sinon → nouvelle organisation (admin).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_code text;
  v_inv invitations;
begin
  v_code := upper(nullif(trim(new.raw_user_meta_data->>'invite_code'), ''));

  if v_code is not null then
    select * into v_inv from invitations
      where code = v_code and used_by is null
      limit 1;
    if v_inv.id is null then
      raise exception 'Code d''invitation invalide ou déjà utilisé.';
    end if;
    insert into profiles (id, organization_id, full_name, role, email)
    values (
      new.id,
      v_inv.organization_id,
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(v_inv.full_name, ''),
        new.email
      ),
      v_inv.role,
      new.email
    );
    update invitations set used_by = new.id, used_at = now() where id = v_inv.id;
    return new;
  end if;

  v_org_name := coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'), ''), 'Mon organisation');
  insert into organizations (name, slug)
  values (v_org_name, 'org-' || replace(new.id::text, '-', ''))
  returning id into v_org_id;
  insert into profiles (id, organization_id, full_name, role, email)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email),
    'admin',
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Verrou : le rôle super_admin (accès plateforme) ne peut pas être attribué
-- depuis l'application par un non-super_admin (anti-escalade de privilèges).
create or replace function guard_super_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'super_admin'
     and old.role is distinct from 'super_admin'
     and auth.uid() is not null
     and coalesce((select role from profiles where id = auth.uid()), 'cashier') <> 'super_admin' then
    raise exception 'Le rôle super_admin ne peut être attribué que par le propriétaire de la plateforme.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_super_admin on profiles;
create trigger trg_guard_super_admin
  before update on profiles
  for each row execute function guard_super_admin();

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

-- ─────────────────────────────────────────────────────────────────────────
-- PHASE 4 : VENTES (ÉCRAN DE CAISSE)
-- PHASE 5 : RÈGLEMENTS MULTI-MODES ET COMPTES CLIENTS (sale_payments,
-- paiement crédit avec vérification du plafond) — fusionnés ici car
-- record_sale() est une seule fonction, réécrite en une fois.
-- ─────────────────────────────────────────────────────────────────────────

create table sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  store_id uuid not null references stores on delete restrict,
  warehouse_id uuid not null references warehouses on delete restrict,
  customer_id uuid references customers on delete set null,
  status text not null default 'completed' check (status in ('held', 'completed', 'cancelled')),
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  author uuid references profiles,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  product_id uuid not null references products on delete restrict,
  product_unit_id uuid references product_units on delete set null,
  label text not null,
  quantity numeric(18,6) not null check (quantity > 0),
  base_quantity numeric(18,6) not null check (base_quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(14,2) not null
);
create index on sale_lines (sale_id);

create table sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  method text not null check (method in ('cash', 'card', 'mobile_money', 'credit', 'check')),
  amount numeric(14,2) not null check (amount > 0)
);
create index on sale_payments (sale_id);

alter table sales enable row level security;
alter table sale_lines enable row level security;
alter table sale_payments enable row level security;

create policy "org read" on sales for select using (organization_id = my_organization_id());
create policy "org read" on sale_lines for select using (
  exists (select 1 from sales s where s.id = sale_id and s.organization_id = my_organization_id())
);
create policy "org read" on sale_payments for select using (
  exists (select 1 from sales s where s.id = sale_id and s.organization_id = my_organization_id())
);

-- Un ticket en attente peut être abandonné (supprimé) par son auteur sans
-- passer par une RPC ; les lignes suivent par cascade. Les ventes finalisées
-- ne sont jamais modifiables/supprimables en direct (traçabilité).
create policy "author delete held" on sales for delete using (
  organization_id = my_organization_id() and status = 'held' and author = auth.uid()
);

create or replace function record_sale(
  p_store_id uuid,
  p_warehouse_id uuid,
  p_status text,
  p_lines jsonb,
  p_customer_id uuid default null,
  p_payments jsonb default null,
  p_idempotency_key uuid default gen_random_uuid()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_sale_id uuid;
  v_line jsonb;
  v_payment jsonb;
  v_product products%rowtype;
  v_unit product_units%rowtype;
  v_customer customers%rowtype;
  v_coefficient numeric;
  v_base_qty numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric;
  v_paid numeric := 0;
  v_available numeric;
  v_label text;
  v_method text;
  v_amount numeric;
begin
  select id into v_existing from sales where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  if coalesce(my_role() in ('admin', 'manager', 'super_admin', 'cashier'), false) is not true then
    raise exception 'Rôle non autorisé à enregistrer une vente';
  end if;
  if p_status not in ('held', 'completed') then
    raise exception 'Statut invalide';
  end if;
  if not exists (select 1 from stores where id = p_store_id and organization_id = my_organization_id()) then
    raise exception 'Magasin introuvable';
  end if;
  if not exists (select 1 from warehouses where id = p_warehouse_id and organization_id = my_organization_id()) then
    raise exception 'Dépôt introuvable';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Le ticket est vide';
  end if;

  insert into sales (organization_id, store_id, warehouse_id, customer_id, status, author, idempotency_key)
  values (my_organization_id(), p_store_id, p_warehouse_id, p_customer_id, p_status, auth.uid(), p_idempotency_key)
  returning id into v_sale_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_product from products
      where id = (v_line->>'product_id')::uuid and organization_id = my_organization_id();
    if not found then
      raise exception 'Article introuvable dans le ticket';
    end if;

    v_coefficient := 1;
    v_label := v_product.label;
    if v_line ? 'product_unit_id' and (v_line->>'product_unit_id') is not null then
      select * into v_unit from product_units where id = (v_line->>'product_unit_id')::uuid and product_id = v_product.id;
      if not found then raise exception 'Unité de vente introuvable'; end if;
      v_coefficient := v_unit.coefficient_to_base;
    end if;

    v_base_qty := (v_line->>'quantity')::numeric * v_coefficient;
    v_line_total := (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric;
    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + round(v_line_total * v_product.tax_rate / 100, 2);

    insert into sale_lines (
      sale_id, product_id, product_unit_id, label, quantity, base_quantity, unit_price, tax_rate, line_total
    ) values (
      v_sale_id, v_product.id,
      case when v_line ? 'product_unit_id' and (v_line->>'product_unit_id') is not null
        then (v_line->>'product_unit_id')::uuid else null end,
      v_label, (v_line->>'quantity')::numeric, v_base_qty, (v_line->>'unit_price')::numeric, v_product.tax_rate, v_line_total
    );

    if p_status = 'completed' then
      select quantity into v_available from stocks
        where product_id = v_product.id and warehouse_id = p_warehouse_id for update;
      if coalesce(v_available, 0) < v_base_qty then
        raise exception 'Stock insuffisant pour % (disponible : %)', v_label, coalesce(v_available, 0);
      end if;
      update stocks set quantity = quantity - v_base_qty, updated_at = now()
        where product_id = v_product.id and warehouse_id = p_warehouse_id;
      insert into stock_movements (
        product_id, warehouse_id, author, type, quantity, previous_qty, new_qty, reason, idempotency_key
      ) values (
        v_product.id, p_warehouse_id, auth.uid(), 'sale', -v_base_qty, v_available, v_available - v_base_qty,
        'Vente ' || v_sale_id, gen_random_uuid()
      );
    end if;
  end loop;

  v_total := v_subtotal + v_tax_total;
  update sales set subtotal = v_subtotal, tax_total = v_tax_total, total = v_total where id = v_sale_id;

  if p_status = 'completed' then
    if p_payments is null or jsonb_array_length(p_payments) = 0 then
      raise exception 'Règlement requis';
    end if;

    for v_payment in select * from jsonb_array_elements(p_payments)
    loop
      v_method := v_payment->>'method';
      v_amount := (v_payment->>'amount')::numeric;
      if v_method not in ('cash', 'card', 'mobile_money', 'credit', 'check') then
        raise exception 'Mode de règlement invalide : %', v_method;
      end if;
      if v_amount is null or v_amount <= 0 then
        raise exception 'Montant de règlement invalide';
      end if;

      if v_method = 'credit' then
        if p_customer_id is null then
          raise exception 'Un client est requis pour un règlement à crédit';
        end if;
        select * into v_customer from customers
          where id = p_customer_id and organization_id = my_organization_id() for update;
        if not found then raise exception 'Client introuvable'; end if;
        if v_customer.balance + v_amount > v_customer.credit_limit then
          raise exception 'Plafond de crédit dépassé pour %', v_customer.name;
        end if;
        update customers set balance = balance + v_amount where id = p_customer_id;
      end if;

      insert into sale_payments (sale_id, method, amount) values (v_sale_id, v_method, v_amount);
      v_paid := v_paid + v_amount;
    end loop;

    if abs(v_paid - v_total) > 0.01 then
      raise exception 'Le montant réglé (%) ne correspond pas au total (%)', v_paid, v_total;
    end if;
  end if;

  return v_sale_id;
end;
$$;
