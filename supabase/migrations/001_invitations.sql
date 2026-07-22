-- ===========================================================================
-- Market-Pro — Migration : invitations de membres
--
-- Permet à un administrateur d'inviter un collègue (caissière, magasinier…)
-- à rejoindre SON organisation avec un rôle précis, via un code d'invitation.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor (projet Market-Pro).
--     Ce script est ADDITIF : il ne supprime ni ne modifie aucune donnée
--     existante. Ne PAS ré-exécuter schema.sql (qui, lui, remet la base à zéro).
-- ===========================================================================

-- 1) Table des invitations ---------------------------------------------------
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code text not null unique,
  role user_role not null default 'cashier',
  full_name text not null default '',
  created_by uuid references profiles on delete set null,
  used_by uuid references profiles on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table invitations enable row level security;

-- Les admins / managers gèrent les invitations de leur organisation.
drop policy if exists "org manage invitations" on invitations;
create policy "org manage invitations" on invitations for all
  using (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  )
  with check (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  );

-- 2) Génération d'une invitation (code aléatoire) ---------------------------
create or replace function create_invitation(p_role user_role, p_full_name text default '')
returns invitations
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := my_organization_id();
  v_role user_role := my_role();
  v_code text;
  v_row invitations;
begin
  if v_org is null or v_role not in ('admin', 'manager', 'super_admin') then
    raise exception 'Seul un administrateur peut inviter un membre.';
  end if;
  if p_role = 'super_admin' then
    raise exception 'Rôle non autorisé pour une invitation.';
  end if;

  -- code court lisible : 8 caractères hexadécimaux majuscules, unique
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

-- 3) Vérification publique d'un code (pour la page d'inscription) ------------
-- Renvoie le nom de l'organisation et le rôle si le code est valide et non
-- utilisé. Ne divulgue rien d'autre : sans danger pour un appel anonyme.
create or replace function invitation_info(p_code text)
returns table (organization_name text, role user_role)
language sql security definer set search_path = public as $$
  select o.name, i.role
  from invitations i
  join organizations o on o.id = i.organization_id
  where i.code = upper(trim(p_code)) and i.used_by is null
  limit 1;
$$;

grant execute on function invitation_info(text) to anon, authenticated;
grant execute on function create_invitation(user_role, text) to authenticated;

-- 4) Provisioning à l'inscription : gère le code d'invitation ---------------
-- Si un invite_code valide est fourni → l'utilisateur rejoint l'organisation
-- de l'invitation avec le rôle prévu. Sinon → comportement self-serve
-- historique (nouvelle organisation, rôle admin).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_code text;
  v_inv invitations;
begin
  v_code := upper(nullif(trim(new.raw_user_meta_data->>'invite_code'), ''));

  if v_code is not null then
    select * into v_inv from invitations
      where code = v_code and used_by is null
      limit 1;
    if v_inv.id is null then
      raise exception 'Code d''invitation invalide ou déjà utilisé.';
    end if;
    insert into profiles (id, organization_id, full_name, role)
    values (
      new.id,
      v_inv.organization_id,
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(v_inv.full_name, ''),
        new.email
      ),
      v_inv.role
    );
    update invitations set used_by = new.id, used_at = now() where id = v_inv.id;
    return new;
  end if;

  -- Pas de code : inscription self-serve classique (nouvelle organisation).
  v_org_name := coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'), ''), 'Mon organisation');
  insert into organizations (name, slug)
  values (v_org_name, 'org-' || replace(new.id::text, '-', ''))
  returning id into v_org_id;
  insert into profiles (id, organization_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email),
    'admin'
  );
  return new;
end;
$$;
