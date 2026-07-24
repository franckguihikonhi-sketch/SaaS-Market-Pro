-- ===========================================================================
-- Market-Pro — Migration : suppression complète d'une entreprise
--
-- Le propriétaire de la plateforme (super_admin) peut supprimer DÉFINITIVEMENT
-- une entreprise cliente et TOUTES ses données (comptes, ventes, achats, stock,
-- articles, magasins, invitations…). La confirmation se fait côté interface.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

create or replace function delete_organization(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_ids uuid[];
begin
  if my_role() <> 'super_admin' then
    raise exception 'Réservé au propriétaire de la plateforme.';
  end if;
  if not exists (select 1 from organizations where id = p_org) then
    raise exception 'Organisation introuvable.';
  end if;
  if p_org = (select organization_id from profiles where id = auth.uid()) then
    raise exception 'Vous ne pouvez pas supprimer votre propre organisation.';
  end if;

  -- Mémoriser les comptes d'authentification liés avant la cascade.
  select array_agg(id) into v_user_ids from profiles where organization_id = p_org;

  -- Supprimer l'organisation → cascade sur toutes ses données rattachées.
  delete from organizations where id = p_org;

  -- Supprimer les comptes d'authentification devenus orphelins.
  if v_user_ids is not null then
    delete from auth.users where id = any(v_user_ids);
  end if;
end;
$$;
grant execute on function delete_organization(uuid) to authenticated;
