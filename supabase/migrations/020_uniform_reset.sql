-- ===========================================================================
-- Market-Pro — Migration : anti-énumération sur « mot de passe oublié »
--
-- request_password_reset ne renvoie plus d'information permettant de deviner
-- si un email existe (ou son rôle). Elle dépose simplement, en interne, une
-- demande pour les salariés — sans rien renvoyer à l'appelant.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

-- Le type de retour change (text → void) : on doit recréer la fonction.
drop function if exists request_password_reset(text);

create or replace function request_password_reset(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  select * into v_p from profiles where lower(email) = lower(trim(p_email)) limit 1;
  -- Pour un salarié (rôle non-administrateur) sans demande en cours : on
  -- enregistre une demande que le propriétaire de la plateforme traitera.
  -- Aucune valeur n'est renvoyée → impossible de déduire si l'email existe.
  if v_p.id is not null
     and v_p.role not in ('admin', 'manager', 'super_admin')
     and not exists (
       select 1 from password_reset_requests
       where profile_id = v_p.id and resolved_at is null
     ) then
    insert into password_reset_requests (organization_id, profile_id, email, full_name)
    values (v_p.organization_id, v_p.id, v_p.email, v_p.full_name);
  end if;
end;
$$;
grant execute on function request_password_reset(text) to anon, authenticated;
