import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Catalogue des permissions applicatives (codes stables que le code
// backend vérifie). Les Roles (Phase 2) assembleront un sous-ensemble de
// ces permissions par organisation.
const PERMISSIONS: Array<{ code: string; category: string; description: string }> = [
  { code: 'sales.create', category: 'sales', description: 'Créer / encaisser une vente' },
  { code: 'sales.void', category: 'sales', description: "Annuler un ticket ou une ligne" },
  { code: 'sales.discount', category: 'sales', description: 'Appliquer une remise' },
  { code: 'sales.read', category: 'sales', description: "Consulter l'historique des ventes" },
  { code: 'products.manage', category: 'catalog', description: 'Créer / modifier les articles' },
  { code: 'products.read', category: 'catalog', description: 'Consulter le catalogue' },
  { code: 'stock.adjust', category: 'stock', description: 'Corriger le stock (casse, perte, vol)' },
  { code: 'stock.transfer', category: 'stock', description: 'Transférer du stock entre dépôts' },
  { code: 'stock.inventory', category: 'stock', description: 'Réaliser un inventaire' },
  { code: 'purchases.manage', category: 'purchases', description: 'Gérer les commandes/achats fournisseurs' },
  { code: 'customers.manage', category: 'customers', description: 'Gérer les clients et comptes clients' },
  { code: 'suppliers.manage', category: 'suppliers', description: 'Gérer les fournisseurs' },
  { code: 'cash.open', category: 'cash', description: 'Ouvrir une session de caisse' },
  { code: 'cash.close', category: 'cash', description: 'Clôturer une session de caisse' },
  { code: 'cash.withdraw', category: 'cash', description: 'Effectuer un retrait/dépôt de caisse' },
  { code: 'reports.view', category: 'reports', description: 'Consulter les rapports et tableaux de bord' },
  { code: 'settings.manage', category: 'admin', description: "Modifier les paramètres de l'organisation" },
  { code: 'users.manage', category: 'admin', description: 'Gérer les utilisateurs et rôles' },
];

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { category: permission.category, description: permission.description },
      create: permission,
    });
  }
  console.log(`Seed terminé : ${PERMISSIONS.length} permissions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
