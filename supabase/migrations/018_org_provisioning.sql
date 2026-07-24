-- ===========================================================================
-- Market-Pro — Migration : provisioning des entreprises par le super_admin
--
-- Le propriétaire de la plateforme (super_admin) crée lui-même les entreprises
-- clientes (nom + nombre de postes) et obtient un code d'accès pour leur
-- premier administrateur. L'auto-inscription publique est désactivée :
-- l'inscription se fait UNIQUEMENT sur code d'invitation.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

-- Crée une entreprise + un code d'accès pour son premier administrateur.
create or replace function create_organization(p_name text, p_seats int, p_admin_name text default '')
returns table (organization_id uuid, invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_code text;
begin
  if my_role() <> 'super_admin' then
    raise exception 'Réservé au propriétaire de la plateforme.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nom de l''entreprise requis.';
  end if;

  insert into organizations (name, slug, max_seats)
  values (
    trim(p_name),
    'org-' || replace(gen_random_uuid()::text, '-', ''),
    greatest(1, coalesce(p_seats, 3))
  )
  returning id into v_org_id;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from invitations where code = v_code);
  end loop;
  insert into invitations (organization_id, code, role, full_name, created_by)
  values (v_org_id, v_code, 'admin', coalesce(nullif(trim(p_admin_name), ''), ''), auth.uid());

  return query select v_org_id, v_code;
end;
$$;
grant execute on function create_organization(text, int, text) to authenticated;

-- Inscription SUR INVITATION UNIQUEMENT : plus de création d'organisation en
-- self-service. Un code valide est obligatoire.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_inv invitations;
  v_max int;
  v_used int;
begin
  v_code := upper(nullif(trim(new.raw_user_meta_data->>'invite_code'), ''));
  if v_code is null then
    raise exception 'Inscription sur invitation uniquement. Demandez un code d''accès au propriétaire de la plateforme.';
  end if;

  select * into v_inv from invitations
    where code = v_code and used_by is null
    limit 1;
  if v_inv.id is null then
    raise exception 'Code d''invitation invalide ou déjà utilisé.';
  end if;

  select max_seats into v_max from organizations where id = v_inv.organization_id;
  select count(*) into v_used from profiles where organization_id = v_inv.organization_id;
  if v_used >= v_max then
    raise exception 'Nombre de postes atteint pour cette organisation.';
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
end;
$$;
