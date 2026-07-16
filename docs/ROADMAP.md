# Feuille de route Market-Pro

Développement par phases, chacune livrée et testée avant de passer à la
suivante — pas de génération monolithique.

## Phase 1 — Architecture complète et base de données ✅

- Monorepo pnpm (`apps/web` Next.js, `apps/api` NestJS).
- Schéma Prisma complet (30+ modèles) : RBAC, catalogue, unités/conversions,
  stock multi-dépôts, achats, ventes, règlements, factures, retours,
  transferts, inventaires, tarification, promotions, audit, paramètres.
- Multi-tenant (`Organization` racine, isolation par `organization_id`).
- Bootstrap NestJS : sécurité (Helmet, CORS, rate limiting), validation,
  logs structurés (Pino), Swagger, gestion d'erreurs uniforme.
- Intégration Supabase (client admin `service_role` côté API).
- Frontend Next.js + Tailwind + shadcn/ui, connecté à l'API (`/health`).
- Docker (dev via `docker-compose.yml`, images de production multi-stage).
- Tests unitaires + e2e de la fondation (config, santé de l'API).

## Phase 2 — Authentification et gestion des utilisateurs

- Intégration Supabase Auth côté frontend (connexion, session).
- Guard NestJS vérifiant les JWT Supabase (`SupabaseAuthGuard`).
- CRUD Utilisateurs, Rôles, assignation de permissions.
- Policies RLS PostgreSQL par organisation (Supabase).
- Décorateur `@RequirePermissions()` + `PermissionsGuard`.

## Phase 3 — Articles, unités et stock

- CRUD Catégories, Marques, Unités, Articles.
- Gestion des unités de vente et coefficients (carton/pack/pièce…),
  conversions et ventes fractionnées.
- Mouvements de stock (achats, casse/perte/vol, transferts, inventaires)
  avec historisation complète et transactions atomiques.
- Tarification multi-niveaux (prix par quantité, par client, par magasin).

## Phase 4 — Écran de caisse type Sage SCD

- Interface caisse clavier-first (raccourcis F2-F10, scan code-barres).
- Recherche article instantanée, grille de ticket, calculs temps réel.
- Mise en attente / reprise de ticket, annulation, duplication.
- WebSocket (Socket.IO) pour la synchronisation temps réel multi-caisse.

## Phase 5 — Règlements et impression

- Règlements multi-modes et mix de paiements sur un même ticket.
- Comptes clients (plafond, solde, points fidélité).
- Impression ticket thermique (58/80 mm) et facture A4 (PDF).
- Mode hors ligne avec synchronisation au retour réseau.

## Phase 6 — Rapports, tableaux de bord et administration

- Tableau de bord (CA, marge, top ventes, stock faible, alertes).
- Rapports (journal caisse, ventes, achats, TVA, marges, inventaires) avec
  export Excel/PDF/CSV.
- Administration multi-magasins et paramètres globaux/par magasin.
- Durcissement sécurité (audit OWASP, revue RLS, tests de charge).
