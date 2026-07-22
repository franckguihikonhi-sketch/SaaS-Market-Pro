-- ===========================================================================
-- Market-Pro — Migration : demandes de réinitialisation de mot de passe
--
-- Un salarié qui a oublié son mot de passe envoie une demande depuis la page
-- « Mot de passe oublié ». La demande arrive chez l'ADMIN (page Équipe), qui
-- déclenche la réinitialisation. Un admin, lui, reçoit directement un email.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor (projet Market-Pro),
--     APRÈS 001_invitations.sql et 002_member_emails.sql. Additif : n'efface
--     aucune donnée.
-- ===========================================================================

create table if not exists password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  profile_id uuid references profiles on delete cascade,
  email text not null,
  full_name text not null default '',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table password_reset_requests enable row level security;

drop policy if exists "org manage reset requests" on password_reset_requests;
create policy "org manage reset requests" on password_reset_requests for all
  using (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  )
  with check (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  );

-- Appel public (page « Mot de passe oublié »). Retourne :
--   'self'     → compte admin : réinitialisation en libre-service (email direct)
--   'employee' → demande enregistrée pour l'administrateur
--   'unknown'  → aucun compte (message générique, sans divulgation)
create or replace function request_password_reset(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  select * into v_p from profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_p.id is null then
    return 'unknown';
  end if;
  if v_p.role in ('admin', 'super_admin') then
    return 'self';
  end if;
  -- évite les doublons : une seule demande en attente par salarié
  if not exists (
    select 1 from password_reset_requests
    where profile_id = v_p.id and resolved_at is null
  ) then
    insert into password_reset_requests (organization_id, profile_id, email, full_name)
    values (v_p.organization_id, v_p.id, v_p.email, v_p.full_name);
  end if;
  return 'employee';
end;
$$;

grant execute on function request_password_reset(text) to anon, authenticated;
