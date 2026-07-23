-- ===========================================================================
-- Market-Pro — Migration : nombre de postes (sièges) par organisation
--
-- Le propriétaire de la plateforme (super_admin) fixe, pour chaque
-- organisation, le nombre de postes autorisés (max_seats). L'application
-- empêche de dépasser ce nombre (à l'invitation et à l'inscription).
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif.
-- ===========================================================================

alter table organizations add column if not exists max_seats int not null default 3;

-- Réglage du nombre de postes par le super_admin.
create or replace function set_org_seats(p_org uuid, p_seats int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() <> 'super_admin' then
    raise exception 'Réservé au propriétaire de la plateforme.';
  end if;
  update organizations set max_seats = greatest(1, p_seats) where id = p_org;
end;
$$;
grant execute on function set_org_seats(uuid, int) to authenticated;

-- create_invitation : refuse si les postes sont épuisés (membres + invitations
-- en attente >= max_seats).
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
  if v_org is null or v_role not in ('admin', 'manager', 'super_admin') then
    raise exception 'Seul un administrateur peut inviter un membre.';
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

-- handle_new_user : à l'inscription avec code, refuse si les postes sont pleins.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_code text;
  v_inv invitations;
  v_max int;
  v_used int;
begin
  v_code := upper(nullif(trim(new.raw_user_meta_data->>'invite_code'), ''));

  if v_code is not null then
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

-- platform_overview : ajoute max_seats et EXCLUT l'organisation du super_admin
-- (le propriétaire de la plateforme n'est pas une entreprise cliente).
create or replace function platform_overview()
returns table (
  organization_id uuid,
  organization_name text,
  created_at timestamptz,
  user_count bigint,
  max_seats int,
  active_count bigint,
  last_activity timestamptz
)
language sql security definer set search_path = public as $$
  select o.id, o.name, o.created_at,
    count(p.id) as user_count,
    o.max_seats,
    count(p.id) filter (where p.last_seen > now() - interval '90 seconds') as active_count,
    max(p.last_seen) as last_activity
  from organizations o
  left join profiles p on p.organization_id = o.id
  where my_role() = 'super_admin' and o.id <> my_organization_id()
  group by o.id, o.name, o.created_at, o.max_seats
  order by o.name;
$$;
