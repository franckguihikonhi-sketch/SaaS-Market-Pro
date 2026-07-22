-- ===========================================================================
-- Market-Pro — Migration : historique des connexions
--
-- Chaque connexion est enregistrée ; l'administrateur consulte l'historique
-- sur son tableau de bord.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor (projet Market-Pro).
--     Additif : n'efface aucune donnée.
-- ===========================================================================

create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  full_name text not null default '',
  role user_role not null default 'cashier',
  logged_in_at timestamptz not null default now()
);

alter table login_events enable row level security;

-- Les admins / managers consultent l'historique de leur organisation.
drop policy if exists "org read login events" on login_events;
create policy "org read login events" on login_events for select
  using (
    organization_id = my_organization_id()
    and my_role() in ('admin', 'manager', 'super_admin')
  );

-- Enregistre la connexion de l'utilisateur courant (appelé après login).
create or replace function record_login()
returns void language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  select * into v_p from profiles where id = auth.uid();
  if v_p.id is null then return; end if;
  insert into login_events (organization_id, profile_id, full_name, role)
  values (v_p.organization_id, v_p.id, v_p.full_name, v_p.role);
end;
$$;

grant execute on function record_login() to authenticated;
