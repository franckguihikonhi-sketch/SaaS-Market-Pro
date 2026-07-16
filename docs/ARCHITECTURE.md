# Architecture backend (apps/api)

## Principes

- **Multi-tenant** : `Organization` est la racine de l'isolation. La quasi
  totalité des tables métier porte `organization_id`. Isolation applicative
  aujourd'hui (Phase 1) ; policies RLS PostgreSQL ajoutées en Phase 2.
- **Auth déléguée à Supabase** : `User.id` == `auth.users.id` (même UUID).
  NestJS ne stocke ni mot de passe ni session — il vérifie les JWT émis par
  Supabase Auth (Phase 2) via le client `service_role` (`SupabaseService`).
- **RBAC paramétrable** : `Permission` est un catalogue applicatif fixe
  (codes stables, ex. `sales.create`) ; `Role` est propre à chaque
  organisation et agrège des permissions ; `UserPermission` permet des
  dérogations fines par utilisateur.
- **Stock en unité de base** : chaque article a une unité de base ; les
  unités de vente (carton, pack…) portent un coefficient vers cette unité.
  Le stock (`Stock`, `StockMovement`) est toujours exprimé en unité de base,
  en `Decimal(18,6)` pour éviter toute erreur d'arrondi sur les ventes
  fractionnées.

## Organisation du code

```
src/
  main.ts                 Bootstrap : sécurité, validation, Swagger, versioning
  app.module.ts            Racine — assemble les modules d'infrastructure et métier
  common/
    config/                Validation typée des variables d'environnement
    decorators/             @Public(), (Phase 2 : @RequirePermissions(), @CurrentUser())
    filters/                Filtre d'exceptions global (réponses d'erreur uniformes)
    guards/                 (Phase 2 : SupabaseAuthGuard, PermissionsGuard)
  prisma/                  PrismaService (client global, connecté au démarrage)
  supabase/                SupabaseService (client admin service_role)
  health/                  /api/v1/health, /api/v1/health/db
```

## Modules métier prévus (Phases 2 à 6)

Chaque domaine ci-dessous devient un module NestJS autonome
(`controller` + `service` + DTO), suivant le même schéma que `health/` :

| Domaine | Phase | Modèles Prisma associés |
|---|---|---|
| `auth` | 2 | — (vérifie les JWT Supabase) |
| `users`, `roles` | 2 | User, Role, Permission, RolePermission, UserPermission |
| `organizations`, `stores`, `warehouses` | 2/3 | Organization, Store, Warehouse |
| `catalog` (produits, catégories, marques, unités) | 3 | Product, Category, Brand, Unit, ProductUnit, UnitConversion |
| `stock` (mouvements, transferts, inventaires) | 3 | Stock, StockMovement, Transfer, Inventory |
| `pricing` (tarifs, promotions) | 3 | PriceList, PriceListItem, Promotion, CustomerGroup |
| `sales` (ventes, caisse) | 4/5 | Sale, SaleLine, CashRegister, CashSession, CashMovement |
| `payments`, `invoices`, `returns` | 5 | Payment, Invoice, Return, ReturnLine |
| `purchases` | 3/5 | Purchase, PurchaseLine, SupplierPayment |
| `customers`, `suppliers` | 3 | Customer, CustomerPayment, Supplier |
| `realtime` (gateway Socket.IO) | 4 | — (diffuse ventes/stock en temps réel) |
| `reports` | 6 | agrégations en lecture sur les modèles ci-dessus |
| `settings` | 6 | Setting |
| `audit` | 2 (transverse) | AuditLog |

Chaque nouveau module s'enregistre simplement dans `app.module.ts`. Les
guards d'authentification/permissions (Phase 2) seront appliqués
globalement, avec `@Public()` pour les routes exemptées (comme `/health`
aujourd'hui).

## Sécurité (mise en place progressive)

- Phase 1 : Helmet, CORS restreint, rate limiting global (`ThrottlerModule`),
  validation stricte des DTO (`class-validator`, `whitelist`), logs
  structurés sans secrets (redaction des headers sensibles).
- Phase 2+ : policies RLS Supabase, guard d'authentification global,
  vérification systématique de `organization_id` sur chaque requête.
- Phase 6 : revue OWASP complète (injection, XSS, CSRF sur les formulaires
  serveur, audit des dépendances).
