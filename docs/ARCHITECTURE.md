# Architecture

## Principes

- **Pas de serveur applicatif séparé** : le frontend Next.js appelle
  Supabase directement via `@supabase/supabase-js` (`src/lib/supabase.ts`).
  Même patron que les autres applications du dépôt (Boulange ERP,
  Fish-Afric, PaieCI).
- **Rigueur métier côté base** : les opérations qui doivent être atomiques
  ou idempotentes (vente, achat, mouvement de stock) sont des fonctions
  PostgreSQL (RPC), appelées via `supabase.rpc('nom_fonction', params)`.
  Le frontend ne fait jamais de calcul métier sensible côté client.
- **Sécurité par Row Level Security** : chaque table sensible a RLS activé ;
  les policies filtrent par `organization_id` via `my_organization_id()`
  (lit `profiles.organization_id` pour l'utilisateur connecté). Il n'y a
  pas de rôle « admin bypass » côté frontend — la clé `anon` publiée dans
  le bundle n'a que les droits accordés par les policies.
- **Multi-tenant** : `organizations` est la racine de l'isolation. Un
  utilisateur (`profiles`) appartient à une organisation ; toutes les
  policies RLS s'appuient sur cette relation.

## Fichiers clés

```
supabase/schema.sql       Source de vérité de la base : tables, types,
                           fonctions RPC, policies RLS. Idempotent —
                           peut être ré-exécuté dans le SQL Editor.
src/lib/supabase.ts        Client Supabase (URL + clé anon publiques).
src/app/page.tsx           Exemple de lecture directe (table organizations).
```

## Ajouter une fonctionnalité

1. Étendre `supabase/schema.sql` (nouvelle table, colonne, ou fonction RPC)
   et le ré-exécuter dans le SQL Editor Supabase.
2. Ajouter les policies RLS correspondantes (lecture/écriture par
   organisation et par rôle).
3. Appeler `supabase.from('table')` (lecture simple) ou
   `supabase.rpc('fonction', params)` (écriture avec logique métier)
   depuis le composant Next.js concerné.

## Sécurité

- La clé `service_role`/`secret` ne doit **jamais** être utilisée côté
  frontend — uniquement la clé `anon`/`publishable`, protégée par RLS.
- Toute opération d'écriture avec des invariants métier (stock, montants,
  idempotence) passe par une fonction RPC `security definer` plutôt que
  par des `insert`/`update` directs depuis le client.
