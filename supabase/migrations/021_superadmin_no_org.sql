-- ===========================================================================
-- Market-Pro — Migration : le super_admin n'appartient à aucune organisation
--
-- Franck (super_admin) est le propriétaire de la plateforme : il n'est membre
-- d'aucune entreprise. On rend donc profiles.organization_id optionnel, on
-- détache le(s) super_admin, et on nettoie leur éventuelle organisation
-- technique restée vide. Les vues plateforme sont rendues robustes au NULL.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

-- 1) Rattachement à une organisation désormais optionnel.
alter table profiles alter column organization_id drop not null;

-- 2) Détacher le super_admin, et supprimer son ancienne organisation si elle
--    est devenue vide (aucun membre, aucune invitation en attente).
do $$
declare v_orgs uuid[];
begin
  select array_agg(distinct organization_id)
    into v_orgs
    from profiles
   where role = 'super_admin' and organization_id is not null;

  update profiles set organization_id = null where role = 'super_admin';

  if v_orgs is not null then
    delete from organizations o
     where o.id = any(v_orgs)
       and not exists (select 1 from profiles p where p.organization_id = o.id)
       and not exists (select 1 from invitations i where i.organization_id = o.id and i.used_by is null);
  end if;
end $$;

-- 3) Vues plateforme : exclusion robuste au NULL (is distinct from).
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
  where (select role from profiles where id = auth.uid()) = 'super_admin'
    and o.id is distinct from (select organization_id from profiles where id = auth.uid())
  group by o.id, o.name, o.created_at, o.max_seats
  order by o.name;
$$;
grant execute on function platform_overview() to authenticated;

create or replace function platform_members()
returns table (
  id uuid,
  full_name text,
  email text,
  role user_role,
  organization_id uuid,
  organization_name text,
  suspended boolean
)
language sql security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.role, p.organization_id, o.name, p.suspended
  from profiles p
  join organizations o on o.id = p.organization_id
  where (select role from profiles where id = auth.uid()) = 'super_admin'
    and p.organization_id is distinct from (select organization_id from profiles where id = auth.uid())
    and p.role <> 'super_admin'
  order by o.name, p.full_name;
$$;
grant execute on function platform_members() to authenticated;
