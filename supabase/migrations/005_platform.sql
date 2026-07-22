-- ===========================================================================
-- Market-Pro — Migration : console plateforme (multi-entreprises)
--
-- Permet au PROPRIÉTAIRE DE LA PLATEFORME (rôle super_admin) de voir toutes
-- les entreprises clientes et leurs agents connectés — SANS accéder aux
-- données métier (ventes, stocks) de chaque entreprise, qui restent isolées
-- par les policies RLS existantes (organization_id = my_organization_id()).
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor (projet Market-Pro).
--     Additif : n'efface aucune donnée.
--     Pour devenir propriétaire plateforme, mets TON profil en super_admin :
--       update profiles set role = 'super_admin' where email = 'ton-email';
-- ===========================================================================

-- Présence « au fil de l'eau » (heartbeat), pour savoir qui est actif.
alter table profiles add column if not exists last_seen timestamptz;

create or replace function touch_last_seen()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_seen = now() where id = auth.uid();
end;
$$;
grant execute on function touch_last_seen() to authenticated;

-- Agrégats par entreprise (réservé au super_admin ; sinon renvoie 0 ligne).
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
    count(p.id) filter (where p.last_seen > now() - interval '5 minutes') as active_count,
    max(p.last_seen) as last_activity
  from organizations o
  left join profiles p on p.organization_id = o.id
  where my_role() = 'super_admin'
  group by o.id, o.name, o.created_at
  order by o.name;
$$;
grant execute on function platform_overview() to authenticated;

-- Agents actuellement connectés (actifs < 5 min), toutes entreprises.
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
    and p.last_seen > now() - interval '5 minutes'
  order by o.name, p.full_name;
$$;
grant execute on function platform_agents() to authenticated;
