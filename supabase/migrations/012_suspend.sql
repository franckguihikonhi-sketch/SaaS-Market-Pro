-- ===========================================================================
-- Market-Pro — Migration : mise en sommeil d'un utilisateur
--
-- Franck (super_admin) peut mettre n'importe quel utilisateur « en sommeil »
-- (compte suspendu) puis le « réveiller ». Un utilisateur en sommeil n'a plus
-- accès à aucune donnée : my_organization_id() renvoie NULL pour lui, ce qui
-- fait échouer toutes les policies RLS filtrées par organisation.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

alter table profiles add column if not exists suspended boolean not null default false;

-- my_organization_id() : NULL si l'utilisateur est en sommeil → aucun accès.
create or replace function my_organization_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when (select suspended from profiles where id = auth.uid()) then null
    else coalesce(
      (select a.organization_id from admin_active_org a
        where a.admin_id = auth.uid()
          and (select role from profiles where id = auth.uid()) = 'super_admin'),
      (select organization_id from profiles where id = auth.uid())
    )
  end;
$$;
grant execute on function my_organization_id() to authenticated;

-- Met en sommeil / réveille un utilisateur (super_admin uniquement).
create or replace function set_user_suspended(p_user uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() <> 'super_admin' then
    raise exception 'Réservé au propriétaire de la plateforme.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Vous ne pouvez pas vous mettre vous-même en sommeil.';
  end if;
  update profiles set suspended = p_suspended where id = p_user;
end;
$$;
grant execute on function set_user_suspended(uuid, boolean) to authenticated;

-- Liste de tous les membres des entreprises clientes (super_admin), avec leur
-- statut de sommeil — pour piloter la mise en sommeil depuis la console.
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
  where my_role() = 'super_admin'
    and p.organization_id <> (select organization_id from profiles where id = auth.uid())
    and p.role <> 'super_admin'
  order by o.name, p.full_name;
$$;
grant execute on function platform_members() to authenticated;

notify pgrst, 'reload schema';
