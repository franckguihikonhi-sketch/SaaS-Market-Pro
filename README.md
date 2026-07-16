# Market-Pro

SaaS professionnel de caisse enregistreuse (type Sage Saisie de Caisse
Décentralisée / Odoo POS / Square), pour les petites boutiques comme pour
les supermarchés multi-magasins.

## Pile technique

- **Frontend** : Next.js (App Router, export statique) + TypeScript +
  Tailwind CSS + shadcn/ui
- **Données** : [Supabase](https://supabase.com) (PostgreSQL + Auth + Row
  Level Security). Le frontend appelle Supabase directement — pas de
  serveur applicatif séparé. La rigueur métier (atomicité, contrôle
  d'accès) est assurée côté base par des fonctions SQL et des policies
  RLS, voir [`supabase/schema.sql`](supabase/schema.sql)
- **Déploiement cible** : hébergeur de site statique connecté au dépôt
  GitHub (Cloudflare Pages ou équivalent) + Supabase Cloud

Même architecture que les autres applications du dépôt (Boulange ERP,
Fish-Afric, PaieCI…).

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
npm run dev                   # http://localhost:3000
npm run build                 # export statique dans out/
```

## Base de données

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) — il crée les tables,
   les fonctions RPC et les policies RLS (idempotent : peut être relancé
   sans risque sur ce projet).
3. **Settings → API** : copier `Project URL` et la clé `anon public` dans
   `.env.local` (et dans les variables d'environnement de l'hébergeur).
   Ne jamais utiliser la clé `service_role`/`secret` côté frontend.
4. Activer Supabase Auth (email/mot de passe) pour les comptes
   utilisateurs.

## Feuille de route

Voir [docs/ROADMAP.md](docs/ROADMAP.md) pour le détail des phases
(authentification, catalogue/stock, écran de caisse, règlements,
rapports) et [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour
l'organisation du schéma et des policies.
