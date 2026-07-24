"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Globe,
  LogOut,
  Package,
  Power,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { useMaintenance } from "@/lib/use-maintenance";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/pos", label: "Caisse", icon: ShoppingCart },
  { href: "/dashboard", label: "Équipe", icon: Users },
  { href: "/catalog", label: "Catalogue", icon: BookOpen },
  { href: "/stores", label: "Magasins", icon: Store },
  { href: "/products", label: "Articles", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/purchases", label: "Achats", icon: ShoppingBag },
  { href: "/reports", label: "Rapports", icon: BarChart3 },
];

// Une caissière ne voit que l'interface de vente.
const CASHIER_LINKS = new Set(["/pos"]);
// Un gestionnaire de stock : stock, achats et articles (son métier).
const WAREHOUSE_LINKS = new Set(["/stock", "/purchases", "/products"]);
// Stock & Articles : réservés au super_admin, à l'admin et au gestionnaire de stock.
const STOCK_LINKS = new Set(["/stock", "/products"]);

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSession();

  // Indicateur de connexion : vert quand en ligne, rouge dès la déconnexion réseau.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const { activeOrgId, activeOrgName, exit } = useMaintenance();
  const inMaintenance = Boolean(activeOrgId);

  const isCashier = profile?.role === "cashier";
  const isWarehouse = profile?.role === "warehouse_keeper";
  const isPlatformOwner = profile?.role === "super_admin";
  // Le propriétaire de la plateforme ne gère pas de boutique : seule la console.
  // Mais en mode maintenance, il voit toute l'interface de l'entreprise ouverte.
  const links = isPlatformOwner
    ? inMaintenance
      ? [...LINKS, { href: "/platform", label: "Plateforme", icon: Globe }]
      : [{ href: "/platform", label: "Plateforme", icon: Globe }]
    : isCashier
      ? LINKS.filter((l) => CASHIER_LINKS.has(l.href))
      : isWarehouse
        ? LINKS.filter((l) => WAREHOUSE_LINKS.has(l.href))
        : profile?.role === "admin" || profile?.role === "manager"
          ? LINKS
          : // Comptable : pas d'accès au Stock ni aux Articles.
            LINKS.filter((l) => !STOCK_LINKS.has(l.href));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleExitMaintenance() {
    // exit() recharge la page sur la console plateforme.
    await exit();
  }

  return (
    <div className="sticky top-2 z-30 flex flex-col gap-2">
      {inMaintenance && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 shadow-sm">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4" />
            Mode maintenance — {activeOrgName}
          </span>
          <span className="hidden text-xs text-amber-700 sm:inline">
            Vous agissez au nom de cette entreprise.
          </span>
          <button
            type="button"
            onClick={() => void handleExitMaintenance()}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            <LogOut className="h-4 w-4" />
            Quitter la maintenance
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/60 bg-white/80 px-2.5 py-1.5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5 backdrop-blur-xl">
      <div className="flex items-center gap-2 pr-1">
        <Link href="/pos" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
            <ShoppingCart className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-900">Market-Pro</span>
        </Link>
        {profile?.organization_name && (
          <>
            <span className="text-slate-300">·</span>
            <span className="max-w-[38vw] truncate text-sm font-semibold text-emerald-700 sm:max-w-[220px]">
              {profile.organization_name}
            </span>
          </>
        )}
      </div>
      <nav className="flex flex-wrap items-center gap-1">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={handleSignOut}
        title={online ? "Connecté — cliquer pour se déconnecter" : "Hors ligne"}
        aria-label="Déconnexion"
        className={cn(
          "ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm transition-colors",
          online ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
        )}
      >
        <Power className="h-4 w-4" />
      </button>
      </div>
    </div>
  );
}
