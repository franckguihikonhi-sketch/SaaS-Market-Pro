# Market-Pro

SaaS professionnel de caisse enregistreuse (type Sage Saisie de Caisse
Décentralisée / Odoo POS / Square), conçu pour les petites boutiques comme
pour les supermarchés multi-magasins.

Ce dépôt est développé **par phases** (voir [docs/ROADMAP.md](docs/ROADMAP.md))
plutôt qu'en une seule fois, pour garder un code cohérent et maintenable.
**Phase 1 — Architecture complète et base de données — est terminée.**

## Pile technique

| Couche | Choix |
|---|---|
| Frontend | Next.js 16 (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | NestJS + TypeScript, API REST versionnée (`/api/v1`) + WebSocket (Socket.IO) |
| Base de données | PostgreSQL (hébergée par [Supabase](https://supabase.com)) |
| ORM | Prisma |
| Authentification | Supabase Auth (JWT géré par Supabase ; NestJS vérifie les tokens côté serveur) |
| Déploiement | Docker · Vercel (frontend) · Railway ou VPS (API) |

## Structure du monorepo

```
apps/
  web/   Next.js — interface (écran de caisse, back-office)
  api/   NestJS — API REST + WebSocket, Prisma, intégration Supabase
docs/
  ROADMAP.md        Détail des 6 phases de développement
  ARCHITECTURE.md    Carte des modules backend et conventions
docker-compose.yml   Stack de développement local (Postgres + API + Web)
```

## Démarrage rapide (développement local)

Prérequis : Node.js 20.9+, pnpm, et soit PostgreSQL local soit un projet
Supabase.

```bash
pnpm install

# Configurer les variables d'environnement
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# → renseigner DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY (voir "Configurer Supabase" ci-dessous)

# Appliquer le schéma Prisma et charger le catalogue de permissions
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec prisma db seed

# Lancer l'API (http://localhost:3001, docs OpenAPI sur /docs)
pnpm dev:api

# Dans un autre terminal : lancer le frontend (http://localhost:3000)
pnpm dev:web
```

Alternative avec Docker (inclut un PostgreSQL local jetable + Adminer sur
`:8080`) :

```bash
docker compose up
```

## Configurer Supabase

Market-Pro est un SaaS multi-tenant : chaque organisation cliente est isolée
(voir `Organization` dans le schéma Prisma). La base de données est
PostgreSQL, hébergée par Supabase.

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **Settings → Database** : copier la chaîne de connexion (utiliser le
   pooler `Transaction` en production serverless) dans `DATABASE_URL`.
3. **Settings → API** : copier `URL`, `anon public key` et
   `service_role key` dans les fichiers `.env` correspondants.
   - `SUPABASE_ANON_KEY` est publique (frontend, protégée par RLS).
   - `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être exposée au
     frontend — elle n'est utilisée que par l'API NestJS.
4. Activer **Supabase Auth** (email/mot de passe, puis fournisseurs
   additionnels si besoin) — l'implémentation applicative arrive en Phase 2.
5. Exécuter les migrations Prisma contre la base Supabase :
   `pnpm --filter api exec prisma migrate deploy`.
6. Les policies RLS PostgreSQL (isolation par `organization_id`) seront
   ajoutées en Phase 2/6, une fois l'authentification en place.

## Base de données

Le schéma Prisma ([apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma))
couvre l'intégralité du modèle métier demandé par le cahier des charges :
utilisateurs/rôles/permissions (RBAC paramétrable), catalogue (articles,
unités de vente avec coefficients et conversions pour gérer les ventes
fractionnées), stock multi-dépôts avec historique complet des mouvements,
achats, ventes, règlements multi-modes, factures, retours, transferts,
inventaires, tarification multi-niveaux, promotions, audit et paramètres —
avec isolation multi-tenant par organisation.

Les quantités utilisent `Decimal(18,6)` (ventes fractionnées sans erreur
d'arrondi, ex. 1/6 de carton) et les montants `Decimal(14,2)`.

## Tests

```bash
pnpm --filter api test        # tests unitaires
pnpm --filter api test:e2e    # tests bout en bout (nécessite une base accessible)
```
