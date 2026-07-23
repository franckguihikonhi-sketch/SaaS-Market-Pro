"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

const HIGHLIGHTS = [
  "Caisse tactile rapide, même hors ligne",
  "Stock et achats fournisseurs suivis en temps réel",
  "Multi-magasins, multi-utilisateurs, données isolées",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Enregistre la connexion pour l'historique.
    void supabase.rpc("record_login");
    // Route selon le rôle : une caissière va directement à la caisse.
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    setLoading(false);
    router.push(
      prof?.role === "cashier"
        ? "/pos"
        : prof?.role === "warehouse_keeper"
          ? "/stock"
          : prof?.role === "super_admin"
            ? "/platform"
            : "/dashboard"
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <Card className="grid w-full max-w-4xl gap-0 overflow-hidden p-0 [--card-spacing:0px] md:grid-cols-2">
        {/* Panneau de marque (masqué sur mobile) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 p-10 text-white md:flex">
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 size-52 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <span className="text-base font-bold tracking-tight">Market-Pro</span>
          </div>

          <div className="relative mt-auto">
            <h2 className="max-w-[16ch] text-2xl font-semibold leading-tight tracking-tight text-balance">
              La caisse enregistreuse qui fait grandir votre commerce.
            </h2>
            <ul className="mt-6 flex flex-col gap-2.5">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-white/90">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-3 w-3" />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col justify-center gap-5 p-8 sm:p-10">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">Market-Pro</span>
          </Link>

          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Bon retour 👋</h1>
            <p className="text-sm text-muted-foreground">Connectez-vous à votre espace Market-Pro.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="vous@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  Mot de passe oublié ?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-medium text-foreground hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
