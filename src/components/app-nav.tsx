"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pos", label: "Caisse" },
  { href: "/dashboard", label: "Équipe" },
  { href: "/catalog", label: "Catalogue" },
  { href: "/stores", label: "Magasins" },
  { href: "/products", label: "Articles" },
  { href: "/stock", label: "Stock" },
  { href: "/reports", label: "Rapports" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3">
      {LINKS.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
