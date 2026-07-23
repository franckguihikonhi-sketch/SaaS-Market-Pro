-- ===========================================================================
-- Market-Pro — Migration : accès « maintenance » universel du propriétaire
--
-- Franck (super_admin) peut « entrer » dans n'importe quelle entreprise
-- cliente pour de la maintenance. Le mécanisme : on mémorise l'organisation
-- active du super_admin, et my_organization_id() renvoie alors CETTE
-- organisation. Comme toutes les policies RLS et RPC existantes filtrent par
-- my_organization_id() (et acceptent déjà le rôle super_admin en écriture),
-- Franck obtient automatiquement un accès complet en lecture/écriture à
-- l'entreprise choisie — sans dupliquer la moindre policy.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif.
-- ===========================================================================

-- Organisation actuellement « ouverte » en maintenance par un super_admin.
create table if not exists admin_active_org (
  admin_id uuid primary key references profiles on delete cascade,
  organization_id uuid not null references organizations on delete cascade,
  set_at timestamptz not null default now()
);

alter table admin_active_org enable row level security;
drop policy if exists "self active org" on admin_active_org;
create policy "self active org" on admin_active_org for select using (admin_id = auth.uid());

-- my_organization_id() : pour un super_admin ayant une organisation active,
-- renvoie cette organisation ; sinon, sa propre organisation.
create or replace function my_organization_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.organization_id
       from admin_active_org a
      where a.admin_id = auth.uid()
        and (select role from profiles where id = auth.uid()) = 'super_admin'),
    (select organization_id from profiles where id = auth.uid())
  );
$$;

-- Chaque utilisateur peut TOUJOURS lire son propre profil, même quand
-- my_organization_id() pointe ailleurs (indispensable en mode maintenance :
-- l'org réelle du super_admin ≠ l'org impersonnée).
drop policy if exists "read self profile" on profiles;
create policy "read self profile" on profiles for select using (id = auth.uid());

-- Ouvre une organisation en maintenance (super_admin uniquement).
create or replace function set_active_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() <> 'super_admin' then
    raise exception 'Réservé au propriétaire de la plateforme.';
  end if;
  if not exists (select 1 from organizations where id = p_org) then
    raise exception 'Organisation introuvable.';
  end if;
  insert into admin_active_org (admin_id, organization_id)
  values (auth.uid(), p_org)
  on conflict (admin_id) do update
    set organization_id = excluded.organization_id, set_at = now();
end;
$$;
grant execute on function set_active_org(uuid) to authenticated;

-- Quitte le mode maintenance : le super_admin revient sur sa propre plateforme.
create or replace function clear_active_org()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from admin_active_org where admin_id = auth.uid();
end;
$$;
grant execute on function clear_active_org() to authenticated;

-- Organisation active de l'appelant (pour l'affichage du bandeau maintenance).
create or replace function current_active_org()
returns table (organization_id uuid, organization_name text)
language sql stable security definer set search_path = public as $$
  select a.organization_id, o.name
  from admin_active_org a
  join organizations o on o.id = a.organization_id
  where a.admin_id = auth.uid();
$$;
grant execute on function current_active_org() to authenticated;

-- platform_overview : exclut TOUJOURS l'organisation RÉELLE du super_admin
-- (indépendamment du mode maintenance en cours).
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
    and o.id <> (select organization_id from profiles where id = auth.uid())
  group by o.id, o.name, o.created_at, o.max_seats
  order by o.name;
$$;
grant execute on function platform_overview() to authenticated;
