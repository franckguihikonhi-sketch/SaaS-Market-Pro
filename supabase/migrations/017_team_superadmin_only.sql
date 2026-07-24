-- ===========================================================================
-- Market-Pro — Migration : seul le super_admin administre les équipes
--
-- « Donner accès » (invitations), gérer les rôles, traiter les
-- réinitialisations de mot de passe et consulter l'historique des connexions
-- sont réservés au propriétaire de la plateforme (super_admin), qui agit sur
-- chaque organisation via le mode maintenance. Les admins / gérants
-- d'entreprise gardent leur accès opérationnel mais ne gèrent plus l'équipe.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

-- Invitations : seul le super_admin peut inviter (avec contrôle des postes).
create or replace function create_invitation(p_role user_role, p_full_name text default '')
returns invitations
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := my_organization_id();
  v_role user_role := my_role();
  v_code text;
  v_row invitations;
  v_max int;
  v_used int;
begin
  if v_org is null or v_role <> 'super_admin' then
    raise exception 'Seul le propriétaire de la plateforme peut inviter un membre.';
  end if;
  if p_role = 'super_admin' then
    raise exception 'Rôle non autorisé pour une invitation.';
  end if;

  select max_seats into v_max from organizations where id = v_org;
  v_used := (select count(*) from profiles where organization_id = v_org)
          + (select count(*) from invitations where organization_id = v_org and used_by is null);
  if v_used >= v_max then
    raise exception 'Postes épuisés : cette organisation a atteint son nombre de postes (%).', v_max;
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

-- Policies : super_admin uniquement pour la gestion des équipes.
drop policy if exists "org manage invitations" on invitations;
create policy "org manage invitations" on invitations for all
  using (organization_id = my_organization_id() and my_role() = 'super_admin')
  with check (organization_id = my_organization_id() and my_role() = 'super_admin');

drop policy if exists "admin update profiles" on profiles;
create policy "admin update profiles" on profiles for update using (
  organization_id = my_organization_id()
  and my_role() = 'super_admin'
  and id <> auth.uid()
);

drop policy if exists "org manage reset requests" on password_reset_requests;
create policy "org manage reset requests" on password_reset_requests for all
  using (organization_id = my_organization_id() and my_role() = 'super_admin')
  with check (organization_id = my_organization_id() and my_role() = 'super_admin');

drop policy if exists "org read login events" on login_events;
create policy "org read login events" on login_events for select
  using (organization_id = my_organization_id() and my_role() = 'super_admin');
