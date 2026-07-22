-- ===========================================================================
-- Market-Pro — Migration : email dans le profil + réinitialisation admin
--
-- Ajoute l'email au profil (lecture par les collègues de l'organisation via
-- la policy "read own profile" existante), pour l'administration des comptes
-- et l'envoi d'un email de réinitialisation de mot de passe par l'admin.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor (projet Market-Pro).
--     Additif : n'efface aucune donnée. Ne PAS ré-exécuter schema.sql.
-- ===========================================================================

alter table profiles add column if not exists email text;

-- Backfill des emails existants depuis auth.users.
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- handle_new_user : enregistre aussi l'email du profil.
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
