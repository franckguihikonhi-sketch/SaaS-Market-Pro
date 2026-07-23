-- ===========================================================================
-- Market-Pro — Migration : ACHATS (approvisionnement fournisseur)
--
-- Un achat = un fournisseur + des lignes (article, quantité, prix) reçues dans
-- un dépôt (le stock augmente automatiquement) + un suivi de paiement
-- (montant payé, reste dû). Le solde du fournisseur reflète le total dû.
--
-- Rôles autorisés : admin, manager, super_admin, warehouse_keeper (gestionnaire
-- de stock — c'est son métier).
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  supplier_id uuid references suppliers on delete set null,
  warehouse_id uuid not null references warehouses on delete restrict,
  reference text not null default '',
  note text not null default '',
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  author uuid references profiles on delete set null,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table if not exists purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases on delete cascade,
  product_id uuid not null references products on delete restrict,
  product_unit_id uuid references product_units on delete set null,
  label text not null,
  quantity numeric(18,6) not null check (quantity > 0),
  base_quantity numeric(18,6) not null check (base_quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null
);
create index if not exists purchase_lines_purchase_idx on purchase_lines (purchase_id);

create table if not exists purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'cash',
  author uuid references profiles on delete set null,
  paid_at timestamptz not null default now()
);
create index if not exists purchase_payments_purchase_idx on purchase_payments (purchase_id);

alter table purchases enable row level security;
alter table purchase_lines enable row level security;
alter table purchase_payments enable row level security;

drop policy if exists "org read" on purchases;
create policy "org read" on purchases for select using (organization_id = my_organization_id());
drop policy if exists "org read" on purchase_lines;
create policy "org read" on purchase_lines for select using (
  exists (select 1 from purchases p where p.id = purchase_id and p.organization_id = my_organization_id())
);
drop policy if exists "org read" on purchase_payments;
create policy "org read" on purchase_payments for select using (
  exists (select 1 from purchases p where p.id = purchase_id and p.organization_id = my_organization_id())
);

-- Création rapide d'un fournisseur (code auto) — accessible au gestionnaire.
create or replace function create_supplier(p_name text, p_phone text default '')
returns suppliers language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_organization_id(); v_code text; v_row suppliers;
begin
  if coalesce(my_role() in ('admin','manager','super_admin','warehouse_keeper'), false) is not true then
    raise exception 'Rôle non autorisé';
  end if;
  if v_org is null then raise exception 'Organisation introuvable'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nom du fournisseur requis'; end if;
  loop
    v_code := 'F' || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from suppliers where organization_id = v_org and code = v_code);
  end loop;
  insert into suppliers (organization_id, code, name, phone)
  values (v_org, v_code, trim(p_name), coalesce(p_phone, ''))
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function create_supplier(text, text) to authenticated;

-- Enregistre un achat : lignes reçues (stock +) + paiement initial éventuel.
create or replace function record_purchase(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_reference text,
  p_note text,
  p_lines jsonb,
  p_paid_now numeric default 0,
  p_payment_method text default 'cash',
  p_idempotency_key uuid default gen_random_uuid()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_org uuid := my_organization_id();
  v_purchase_id uuid;
  v_line jsonb;
  v_product products%rowtype;
  v_unit product_units%rowtype;
  v_coeff numeric;
  v_qty numeric;
  v_price numeric;
  v_base numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_prev numeric;
  v_paid numeric := 0;
begin
  select id into v_existing from purchases where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  if coalesce(my_role() in ('admin','manager','super_admin','warehouse_keeper'), false) is not true then
    raise exception 'Rôle non autorisé à enregistrer un achat';
  end if;
  if v_org is null then raise exception 'Organisation introuvable'; end if;
  if not exists (select 1 from warehouses where id = p_warehouse_id and organization_id = v_org) then
    raise exception 'Dépôt introuvable';
  end if;
  if p_supplier_id is not null
     and not exists (select 1 from suppliers where id = p_supplier_id and organization_id = v_org) then
    raise exception 'Fournisseur introuvable';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'L''achat ne contient aucune ligne';
  end if;

  insert into purchases (organization_id, supplier_id, warehouse_id, reference, note, author, idempotency_key)
  values (v_org, p_supplier_id, p_warehouse_id, coalesce(p_reference, ''), coalesce(p_note, ''), auth.uid(), p_idempotency_key)
  returning id into v_purchase_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_product from products where id = (v_line->>'product_id')::uuid and organization_id = v_org;
    if not found then raise exception 'Article introuvable dans l''achat'; end if;

    v_coeff := 1;
    if v_line ? 'product_unit_id' and (v_line->>'product_unit_id') is not null then
      select * into v_unit from product_units where id = (v_line->>'product_unit_id')::uuid and product_id = v_product.id;
      if not found then raise exception 'Unité d''achat introuvable'; end if;
      v_coeff := v_unit.coefficient_to_base;
    end if;

    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantité invalide'; end if;
    if v_price is null or v_price < 0 then raise exception 'Prix invalide'; end if;
    v_base := v_qty * v_coeff;
    v_line_total := round(v_qty * v_price, 2);
    v_total := v_total + v_line_total;

    insert into purchase_lines (purchase_id, product_id, product_unit_id, label, quantity, base_quantity, unit_price, line_total)
    values (
      v_purchase_id, v_product.id,
      case when v_line ? 'product_unit_id' and (v_line->>'product_unit_id') is not null
        then (v_line->>'product_unit_id')::uuid else null end,
      v_product.label, v_qty, v_base, v_price, v_line_total
    );

    insert into stocks (product_id, warehouse_id, quantity)
    values (v_product.id, p_warehouse_id, 0)
    on conflict (product_id, warehouse_id) do nothing;
    select quantity into v_prev from stocks
      where product_id = v_product.id and warehouse_id = p_warehouse_id for update;
    update stocks set quantity = v_prev + v_base, updated_at = now()
      where product_id = v_product.id and warehouse_id = p_warehouse_id;
    insert into stock_movements (product_id, warehouse_id, author, type, quantity, previous_qty, new_qty, reason, idempotency_key)
    values (v_product.id, p_warehouse_id, auth.uid(), 'purchase_receipt', v_base, v_prev, v_prev + v_base,
      'Achat ' || v_purchase_id, gen_random_uuid());

    update products set purchase_price = v_price where id = v_product.id;
  end loop;

  v_paid := least(greatest(coalesce(p_paid_now, 0), 0), v_total);
  update purchases set total = v_total, paid = v_paid where id = v_purchase_id;
  if v_paid > 0 then
    insert into purchase_payments (purchase_id, amount, method, author)
    values (v_purchase_id, v_paid, coalesce(p_payment_method, 'cash'), auth.uid());
  end if;
  if p_supplier_id is not null then
    update suppliers set balance = balance + (v_total - v_paid) where id = p_supplier_id;
  end if;

  return v_purchase_id;
end;
$$;
grant execute on function record_purchase(uuid, uuid, text, text, jsonb, numeric, text, uuid) to authenticated;

-- Ajoute un règlement à un achat (suivi de paiement).
create or replace function add_purchase_payment(p_purchase uuid, p_amount numeric, p_method text default 'cash')
returns void language plpgsql security definer set search_path = public as $$
declare v_p purchases%rowtype; v_remaining numeric;
begin
  if coalesce(my_role() in ('admin','manager','super_admin','warehouse_keeper'), false) is not true then
    raise exception 'Rôle non autorisé';
  end if;
  select * into v_p from purchases where id = p_purchase and organization_id = my_organization_id() for update;
  if not found then raise exception 'Achat introuvable'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  v_remaining := v_p.total - v_p.paid;
  if p_amount > v_remaining + 0.01 then
    raise exception 'Le règlement dépasse le reste dû (%).', v_remaining;
  end if;
  insert into purchase_payments (purchase_id, amount, method, author)
  values (p_purchase, p_amount, coalesce(p_method, 'cash'), auth.uid());
  update purchases set paid = paid + p_amount where id = p_purchase;
  if v_p.supplier_id is not null then
    update suppliers set balance = balance - p_amount where id = v_p.supplier_id;
  end if;
end;
$$;
grant execute on function add_purchase_payment(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
