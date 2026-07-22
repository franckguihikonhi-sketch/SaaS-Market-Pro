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
    const { data: kind } = await supabase.rpc("request_password_reset", { p_email: email });
    if (kind === "self") {
      // Compte administrateur : réinitialisation en libre-service.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/SaaS-Market-Pro/reset-password/`,
      });
      setMessage("Un email de réinitialisation vous a été envoyé. Vérifiez votre boîte mail.");
    } else {
      // Salarié (ou email inconnu) : la demande est transmise à l'administrateur.
      setMessage(
        "Votre demande a été transmise à votre administrateur. Il réinitialisera votre mot de passe."
      );
    }
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
            Saisissez votre email. Si vous êtes salarié, votre administrateur sera prévenu ; si vous
            êtes administrateur, vous recevrez un email de réinitialisation.
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
