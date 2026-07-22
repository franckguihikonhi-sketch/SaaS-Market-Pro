"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // supabase-js établit automatiquement la session de récupération à partir
    // du lien reçu par email (événement PASSWORD_RECOVERY).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 p-8">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20">
          <ShoppingCart className="h-5 w-5" />
        </span>
        <span className="text-xl font-bold tracking-tight text-slate-900">Market-Pro</span>
      </Link>
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>
            {done
              ? "Votre mot de passe a été mis à jour."
              : ready
                ? "Choisissez votre nouveau mot de passe."
                : "Ouvrez cette page depuis le lien reçu par email."}
          </CardDescription>
        </CardHeader>

        {done ? (
          <CardFooter>
            <Link href="/login" className="text-sm underline">
              Aller à la connexion
            </Link>
          </CardFooter>
        ) : ready ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirmer</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardFooter className="flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Le lien est peut-être expiré. Demandez une nouvelle réinitialisation.
            </p>
            <Link href="/login" className="text-sm underline">
              Retour à la connexion
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
