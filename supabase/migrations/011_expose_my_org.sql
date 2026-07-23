-- ===========================================================================
-- Market-Pro — Migration : exposer my_organization_id() au frontend
--
-- Le frontend appelle désormais my_organization_id() (RPC) pour connaître
-- l'organisation EFFECTIVE de l'utilisateur — indispensable au mode
-- maintenance, où un super_admin agit au nom d'une autre entreprise. On
-- s'assure que le rôle « authenticated » peut exécuter cette fonction.
--
-- ⚠️  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor. Additif, idempotent.
-- ===========================================================================

grant execute on function my_organization_id() to authenticated;
