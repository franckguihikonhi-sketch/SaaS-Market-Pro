"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Globe,
  LogOut,
  Package,
  ShoppingCart,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/pos", label: "Caisse", icon: ShoppingCart },
  { href: "/dashboard", label: "Équipe", icon: Users },
  { href: "/catalog", label: "Catalogue", icon: BookOpen },
  { href: "/stores", label: "Magasins", icon: Store },
  { href: "/products", label: "Articles", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/reports", label: "Rapports", icon: BarChart3 },
];

// Une caissière ne voit que l'interface de vente.
const CASHIER_LINKS = new Set(["/pos"]);

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSession();

  const isCashier = profile?.role === "cashier";
  const isPlatformOwner = profile?.role === "super_admin";
  const links = isCashier
    ? LINKS.filter((l) => CASHIER_LINKS.has(l.href))
    : isPlatformOwner
      ? [{ href: "/platform", label: "Plateforme", icon: Globe }, ...LINKS]
      : LINKS;

  async function handleSignOut() {
    await supabase.rpc("go_offline");
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <Link href="/pos" className="flex items-center gap-2 pr-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
          <ShoppingCart className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold tracking-tight text-slate-900">Market-Pro</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
        className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
    </div>
  );
}
