"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

export default function Home() {
  const router = useRouter();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && session) router.push("/dashboard");
  }, [loading, session, router]);

  if (loading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/20">
          <ShoppingCart className="h-8 w-8" />
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Market-Pro</h1>
        <p className="max-w-md text-lg text-slate-500">
          La caisse enregistreuse professionnelle — pour les petites boutiques
          comme pour les supermarchés multi-magasins.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className={buttonVariants({ variant: "default", className: "bg-emerald-600 hover:bg-emerald-700" })}
        >
          Créer une organisation
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Se connecter
        </Link>
      </div>
    </div>
  );
}
