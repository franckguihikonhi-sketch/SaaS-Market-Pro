-- ===========================================================================
-- Market-Pro — Migration : présence plus réactive (connexion/déconnexion)
--
-- Réduit la fenêtre « en ligne » de 5 min à 90 s (le client envoie un signal
-- toutes les 30 s), et ajoute go_offline() appelé à la déconnexion pour
-- retirer immédiatement l'agent de la liste des connectés.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif.
-- ===========================================================================

create or replace function platform_overview()
returns table (
  organization_id uuid,
  organization_name text,
  created_at timestamptz,
  user_count bigint,
  active_count bigint,
  last_activity timestamptz
)
language sql security definer set search_path = public as $$
  select o.id, o.name, o.created_at,
    count(p.id) as user_count,
    count(p.id) filter (where p.last_seen > now() - interval '90 seconds') as active_count,
    max(p.last_seen) as last_activity
  from organizations o
  left join profiles p on p.organization_id = o.id
  where my_role() = 'super_admin'
  group by o.id, o.name, o.created_at
  order by o.name;
$$;

create or replace function platform_agents()
returns table (
  organization_name text,
  full_name text,
  role user_role,
  last_seen timestamptz
)
language sql security definer set search_path = public as $$
  select o.name, p.full_name, p.role, p.last_seen
  from profiles p
  join organizations o on o.id = p.organization_id
  where my_role() = 'super_admin'
    and p.last_seen > now() - interval '90 seconds'
  order by o.name, p.full_name;
$$;

-- Marque l'utilisateur courant hors ligne (appelé juste avant la déconnexion).
create or replace function go_offline()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_seen = null where id = auth.uid();
end;
$$;
grant execute on function go_offline() to authenticated;
