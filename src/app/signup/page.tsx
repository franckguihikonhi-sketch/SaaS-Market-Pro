"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Gérant",
  cashier: "Caissier(ère)",
  warehouse_keeper: "Magasinier",
  accountant: "Comptable",
};

type InviteInfo = { organization_name: string; role: string };

export default function SignupPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteChecked, setInviteChecked] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function checkInvite() {
    const code = inviteCode.trim();
    if (!code) {
      setInviteInfo(null);
      setInviteChecked(false);
      return;
    }
    setCheckingInvite(true);
    const { data } = await supabase.rpc("invitation_info", { p_code: code });
    setCheckingInvite(false);
    const row = (data as InviteInfo[] | null)?.[0] ?? null;
    setInviteInfo(row);
    setInviteChecked(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (inviteCode.trim() && !inviteInfo) {
      setError("Code d'invitation invalide ou déjà utilisé.");
      return;
    }
    setLoading(true);
    const data = inviteInfo
      ? { full_name: fullName, invite_code: inviteCode.trim() }
      : { organization_name: organizationName, full_name: fullName };
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (signUpData.session) {
      void supabase.rpc("record_login");
      router.push(inviteInfo?.role === "cashier" ? "/pos" : "/dashboard");
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 p-8">
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader>
            <CardTitle>Vérifiez vos emails</CardTitle>
            <CardDescription>
              Un lien de confirmation a été envoyé à {email}. Cliquez dessus
              pour activer votre compte, puis connectez-vous.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="text-sm underline">
              Retour à la connexion
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
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
          <CardTitle>{inviteInfo ? "Rejoindre une équipe" : "Créer votre organisation"}</CardTitle>
          <CardDescription>
            {inviteInfo
              ? "Créez votre compte pour rejoindre votre équipe."
              : "Vous serez administrateur de votre espace Market-Pro"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite">Code d&apos;invitation (optionnel)</Label>
              <Input
                id="invite"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setInviteChecked(false);
                }}
                onBlur={checkInvite}
                placeholder="Reçu de votre employeur"
                className="font-mono uppercase"
              />
              {checkingInvite && (
                <p className="text-xs text-muted-foreground">Vérification…</p>
              )}
              {inviteInfo && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700">
                  Vous rejoignez <strong>{inviteInfo.organization_name}</strong> en tant que{" "}
                  {ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}.
                </p>
              )}
              {inviteChecked && !inviteInfo && inviteCode.trim() && (
                <p className="text-xs text-destructive">Code invalide ou déjà utilisé.</p>
              )}
            </div>

            {!inviteInfo && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="organization">Nom de l&apos;organisation</Label>
                <Input
                  id="organization"
                  required={!inviteInfo}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Votre nom</Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading
                ? "Création…"
                : inviteInfo
                  ? "Rejoindre l'équipe"
                  : "Créer mon organisation"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link href="/login" className="underline">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
