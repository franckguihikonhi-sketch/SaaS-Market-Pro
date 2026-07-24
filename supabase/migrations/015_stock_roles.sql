-- ===========================================================================
-- Market-Pro — Migration : rôles autorisés sur le Stock et les Articles
--
-- Seuls le super_admin, l'admin et le gestionnaire de stock (warehouse_keeper)
-- peuvent créer / modifier les articles et le catalogue associé
-- (unités, catégories, marques, unités d'article). Le gérant (manager) et le
-- comptable perdent l'écriture sur ces éléments.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

drop policy if exists "admin write" on products;
create policy "admin write" on products for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on units;
create policy "admin write" on units for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on categories;
create policy "admin write" on categories for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on brands;
create policy "admin write" on brands for all using (
  organization_id = my_organization_id()
  and my_role() in ('admin', 'super_admin', 'warehouse_keeper')
);

drop policy if exists "admin write" on product_units;
create policy "admin write" on product_units for all using (
  exists (
    select 1 from products p
    where p.id = product_id
      and p.organization_id = my_organization_id()
      and my_role() in ('admin', 'super_admin', 'warehouse_keeper')
  )
);
