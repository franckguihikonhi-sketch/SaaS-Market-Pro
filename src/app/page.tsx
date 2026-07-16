"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Market-Pro</h1>
        <p className="max-w-md text-muted-foreground">
          SaaS de caisse enregistreuse professionnelle — pour les petites
          boutiques comme pour les supermarchés multi-magasins.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/signup" className={buttonVariants({ variant: "default" })}>
          Créer une organisation
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Se connecter
        </Link>
      </div>
    </div>
  );
}
