-- ===========================================================================
-- Market-Pro — Migration : verrou de sécurité sur le rôle super_admin
--
-- Empêche qu'un administrateur de boutique s'octroie (ou octroie) le rôle
-- super_admin — qui donne accès à la console plateforme (toutes entreprises).
-- Seul le propriétaire de la plateforme (déjà super_admin) ou une requête SQL
-- directe (auth.uid() null, ex. SQL Editor) peut attribuer ce rôle.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif.
-- ===========================================================================

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
