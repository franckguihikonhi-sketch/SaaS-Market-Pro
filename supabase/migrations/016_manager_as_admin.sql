-- ===========================================================================
-- Market-Pro — Migration : le gérant (manager) est considéré comme un admin
--
-- Le gérant obtient les mêmes droits que l'administrateur : écriture sur les
-- articles et le catalogue, et gestion des profils de l'équipe.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

drop policy if exists "admin write" on products;
create policy "admin write" on products for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'manager', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on units;
create policy "admin write" on units for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'manager', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on categories;
create policy "admin write" on categories for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'manager', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on brands;
create policy "admin write" on brands for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'manager', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on product_units;
create policy "admin write" on product_units for all using (
  exists (
    select 1 from products p
    where p.id = product_id
      and p.organization_id = my_organization_id()
      and my_role() in ('admin', 'manager', 'super_admin', 'warehouse_keeper')
  )
);

-- Gestion des profils (rôles) : le gérant peut modifier ses collègues, comme
-- l'admin (jamais son propre profil ; l'escalade en super_admin reste bloquée).
drop policy if exists "admin update profiles" on profiles;
create policy "admin update profiles" on profiles for update using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'manager', 'super_admin')
  and id <> auth.uid()
);
