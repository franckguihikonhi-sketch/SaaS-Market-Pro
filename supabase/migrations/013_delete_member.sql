-- ===========================================================================
-- Market-Pro — Migration : suppression définitive d'un membre
--
-- Franck (super_admin) peut supprimer définitivement n'importe quel membre,
-- quelle que soit l'organisation. On supprime le compte d'authentification
-- (auth.users) ; par cascade, le profil et les données rattachées suivent.
-- L'historique métier (ventes, mouvements de stock) est conservé : on détache
-- simplement l'auteur (author = NULL) avant la suppression.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

create or replace function delete_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target_role user_role;
begin
  if my_role() <> 'super_admin' then
    raise exception 'Réservé au propriétaire de la plateforme.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Vous ne pouvez pas vous supprimer vous-même.';
  end if;

  select role into v_target_role from profiles where id = p_user;
  if v_target_role is null then
    raise exception 'Membre introuvable.';
  end if;
  if v_target_role = 'super_admin' then
    raise exception 'Impossible de supprimer un autre propriétaire de plateforme.';
  end if;

  -- On conserve l'historique en détachant l'auteur (les FK author sont en
  -- NO ACTION et bloqueraient sinon la suppression).
  update sales set author = null where author = p_user;
  update stock_movements set author = null where author = p_user;

  -- Suppression du compte d'authentification → cascade sur profiles et le reste.
  delete from auth.users where id = p_user;
end;
$$;
grant execute on function delete_member(uuid) to authenticated;

notify pgrst, 'reload schema';
