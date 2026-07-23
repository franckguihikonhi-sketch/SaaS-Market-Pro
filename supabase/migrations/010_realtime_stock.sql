-- ===========================================================================
-- Market-Pro — Migration : stock EN TEMPS RÉEL
--
-- Active la réplication Realtime de Supabase sur les tables de stock, afin
-- que le gestionnaire de stock voie les quantités diminuer en direct dès
-- qu'une vente est enregistrée (record_sale décrémente stocks et insère un
-- mouvement de type 'sale'). Les policies RLS existantes s'appliquent : chaque
-- utilisateur ne reçoit en temps réel que le stock de SON organisation.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stocks'
  ) then
    alter publication supabase_realtime add table stocks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_movements'
  ) then
    alter publication supabase_realtime add table stock_movements;
  end if;
end $$;
