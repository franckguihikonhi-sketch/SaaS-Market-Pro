# Feuille de route Market-Pro

Développement par phases, chacune livrée et testée avant de passer à la
suivante.

## Phase 1 — Architecture, base de données & connexion ✅

- Frontend Next.js (export statique) + Tailwind + shadcn/ui.
- Schéma Supabase (`supabase/schema.sql`) : tenancy multi-organisation,
  profils/rôles, magasins/dépôts, catalogue (articles, unités de vente et
  coefficients pour les ventes fractionnées), stock avec historique des
  mouvements, clients, fournisseurs — avec policies RLS par organisation.
- Connexion frontend ↔ Supabase vérifiée bout en bout (page d'accueil).

## Phase 2 — Authentification et gestion des utilisateurs

- Connexion Supabase Auth (email/mot de passe), session côté client.
- Écrans de gestion des utilisateurs et rôles (table `profiles`).
- Policies RLS d'écriture affinées par rôle pour chaque table.

## Phase 3 — Articles, unités et stock

- CRUD Catégories, Marques, Unités, Articles.
- Gestion des unités de vente et coefficients (carton/pack/pièce…),
  ventes fractionnées.
- Fonctions RPC pour les mouvements de stock (achats, casse/perte/vol,
  transferts, inventaires), transactionnelles et idempotentes.
- Tarification multi-niveaux (prix par quantité, par client, par magasin).

## Phase 4 — Écran de caisse type Sage SCD

- Interface caisse clavier-first (raccourcis F2-F10, scan code-barres).
- Recherche article instantanée, grille de ticket, calculs temps réel.
- Mise en attente / reprise de ticket, annulation, duplication.
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) pour la
  synchronisation multi-caisse.

## Phase 5 — Règlements et impression

- Fonction RPC `record_sale` : règlements multi-modes et mix de paiements
  sur un même ticket, atomique et idempotente (même patron que
  `record_purchase`/`record_production` dans Boulange ERP).
- Comptes clients (plafond, solde, points fidélité).
- Impression ticket thermique (58/80 mm) et facture A4 (PDF).
- Mode hors ligne avec synchronisation au retour réseau.

## Phase 6 — Rapports, tableaux de bord et administration

- Tableau de bord (CA, marge, top ventes, stock faible, alertes).
- Rapports (journal caisse, ventes, achats, TVA, marges, inventaires) avec
  export Excel/PDF/CSV.
- Administration multi-magasins et paramètres globaux/par magasin.
- Durcissement sécurité (audit OWASP, revue RLS).
