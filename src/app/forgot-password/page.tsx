"use client";

import { useState } from "react";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    // On effectue TOUJOURS les deux actions, quel que soit l'email : dépôt d'une
    // éventuelle demande (côté base, silencieux) + envoi d'un lien de
    // réinitialisation (Supabase ne révèle jamais si l'email existe). Puis un
    // message générique unique → aucune énumération d'email possible.
    await supabase.rpc("request_password_reset", { p_email: email });
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/SaaS-Market-Pro/reset-password/`,
    });
    setMessage(
      "Si un compte est associé à cet email, un lien de réinitialisation vient d'être envoyé. " +
        "Si vous êtes salarié sans accès à cet email, votre administrateur pourra réinitialiser votre mot de passe."
    );
    setLoading(false);
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
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Saisissez votre email. Vous recevrez un lien de réinitialisation si un compte y est
            associé.
          </CardDescription>
        </CardHeader>
        {message ? (
          <>
            <CardContent>
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {message}
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/login" className="text-sm underline">
                Retour à la connexion
              </Link>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? "Envoi…" : "Envoyer la demande"}
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground underline">
                Retour à la connexion
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
