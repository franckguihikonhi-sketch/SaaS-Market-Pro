"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession, type Profile } from "@/lib/use-session";
import { useOnlineMembers } from "@/lib/use-presence";

// Rôles attribuables depuis l'interface. « super_admin » (propriétaire de la
// plateforme) en est volontairement exclu : il se définit uniquement en base,
// pour empêcher toute escalade de privilèges depuis une boutique.
const ROLES = ["admin", "manager", "cashier", "warehouse_keeper", "accountant"];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Gérant",
  cashier: "Caissier(ère)",
  warehouse_keeper: "Magasinier",
  accountant: "Comptable",
};
// Rôles qu'un admin peut attribuer via une invitation (pas super_admin).
const INVITE_ROLES = ["cashier", "manager", "warehouse_keeper", "accountant", "admin"];

type OrgProfile = Profile & { email?: string | null; organization?: { name: string } | null };
type ResetRequest = { id: string; email: string; full_name: string; requested_at: string };
type LoginEvent = { id: string; full_name: string; role: string; logged_in_at: string };
type Invitation = {
  id: string;
  code: string;
  role: string;
  full_name: string;
  used_by: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const allOnline = useOnlineMembers();
  // Présence globale → on ne garde que les membres de SA propre organisation.
  const onlineMembers = allOnline.filter((m) => m.organization_id === profile?.organization_id);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [colleagues, setColleagues] = useState<OrgProfile[]>([]);
  const [loadingColleagues, setLoadingColleagues] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteRole, setInviteRole] = useState("cashier");
  const [inviteName, setInviteName] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
  }, [loading, session, profile, router]);

  const loadOrgData = useCallback(async () => {
    if (!profile) return;
    setLoadingColleagues(true);
    const [{ data: org }, { data: profiles }, { data: invites }, { data: resets }, { data: logins }] =
      await Promise.all([
      supabase.from("organizations").select("name").eq("id", profile.organization_id).single(),
      supabase
        .from("profiles")
        .select("id, organization_id, full_name, role, email")
        .eq("organization_id", profile.organization_id)
        .order("full_name"),
      supabase
        .from("invitations")
        .select("id, code, role, full_name, used_by, created_at")
        .is("used_by", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("password_reset_requests")
        .select("id, email, full_name, requested_at")
        .is("resolved_at", null)
        .order("requested_at", { ascending: false }),
      supabase
        .from("login_events")
        .select("id, full_name, role, logged_in_at")
        .order("logged_in_at", { ascending: false })
        .limit(20),
    ]);
    setOrganizationName(org?.name ?? "");
    setColleagues((profiles as OrgProfile[]) ?? []);
    setInvitations((invites as Invitation[]) ?? []);
    setResetRequests((resets as ResetRequest[]) ?? []);
    setLoginEvents((logins as LoginEvent[]) ?? []);
    setLoadingColleagues(false);
  }, [profile]);

  async function processResetRequest(req: ResetRequest, sendEmail: boolean) {
    if (sendEmail) {
      const redirectTo = `${window.location.origin}/SaaS-Market-Pro/reset-password/`;
      const { error } = await supabase.auth.resetPasswordForEmail(req.email, { redirectTo });
      if (error) {
        setResetMsg({ text: error.message, ok: false });
        return;
      }
    }
    await supabase
      .from("password_reset_requests")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    setResetRequests((cur) => cur.filter((r) => r.id !== req.id));
    setResetMsg({
      text: sendEmail
        ? `Email de réinitialisation envoyé à ${req.email}.`
        : "Demande ignorée.",
      ok: true,
    });
  }

  async function createInvite() {
    setInviteBusy(true);
    setInviteError(null);
    const { data, error } = await supabase.rpc("create_invitation", {
      p_role: inviteRole,
      p_full_name: inviteName,
    });
    setInviteBusy(false);
    if (error) {
      setInviteError(error.message);
      return;
    }
    const created = data as Invitation;
    setInvitations((cur) => [created, ...cur]);
    setInviteName("");
    setCopiedCode(created.code);
    try {
      await navigator.clipboard.writeText(created.code);
    } catch {
      /* le presse-papiers peut être indisponible : le code reste affiché */
    }
  }

  async function revokeInvite(id: string) {
    const previous = invitations;
    setInvitations((cur) => cur.filter((i) => i.id !== id));
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) setInvitations(previous);
  }

  async function resetPassword(member: OrgProfile) {
    if (!member.email) {
      setResetMsg({ text: "Email inconnu pour ce membre.", ok: false });
      return;
    }
    const redirectTo = `${window.location.origin}/SaaS-Market-Pro/reset-password/`;
    const { error } = await supabase.auth.resetPasswordForEmail(member.email, { redirectTo });
    setResetMsg(
      error
        ? { text: error.message, ok: false }
        : { text: `Email de réinitialisation envoyé à ${member.email}.`, ok: true }
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, setLoadingColleagues(true) is the initial loading flag
    void loadOrgData();
  }, [loadOrgData]);

  async function updateRole(colleagueId: string, role: string) {
    const previous = colleagues;
    setColleagues((cur) => cur.map((c) => (c.id === colleagueId ? { ...c, role } : c)));
    const { error } = await supabase.from("profiles").update({ role }).eq("id", colleagueId);
    if (error) setColleagues(previous);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AppNav />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {organizationName || "Market-Pro"}
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Connecté en tant que {profile.full_name} —{" "}
              <Badge variant="secondary">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Se déconnecter
          </Button>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Connectés en temps réel
              </CardTitle>
              <CardDescription>
                {onlineMembers.length} personne{onlineMembers.length > 1 ? "s" : ""} en ligne
                actuellement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {onlineMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Personne pour l&apos;instant.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {onlineMembers.map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-800">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[m.role] ?? m.role} · depuis{" "}
                        {new Date(m.online_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && resetRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Demandes de réinitialisation</CardTitle>
              <CardDescription>
                Des salariés ont oublié leur mot de passe. Cliquez sur « Réinitialiser » pour leur
                envoyer un email de réinitialisation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salarié</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Demandé le</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resetRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.requested_at).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => void processResetRequest(r, true)}
                          >
                            Réinitialiser
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void processResetRequest(r, false)}
                          >
                            Ignorer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Ajouter un membre</CardTitle>
              <CardDescription>
                Générez un code d&apos;invitation et communiquez-le à la personne. Elle crée son
                compte sur la page d&apos;inscription avec ce code et rejoint automatiquement votre
                organisation avec le rôle choisi.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Rôle</span>
                  <Select
                    items={INVITE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                    value={inviteRole}
                    onValueChange={(v) => v && setInviteRole(v)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Nom (optionnel)</span>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ex. Awa Diallo"
                  />
                </div>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void createInvite()}
                  disabled={inviteBusy}
                >
                  {inviteBusy ? "Génération…" : "Générer un code"}
                </Button>
              </div>

              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
              {copiedCode && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="text-sm text-emerald-700">Code généré (copié) :</span>
                  <span className="font-mono text-lg font-bold tracking-widest text-emerald-800">
                    {copiedCode}
                  </span>
                </div>
              )}

              {invitations.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Invitations en attente</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono font-semibold tracking-widest">
                            {inv.code}
                          </TableCell>
                          <TableCell>{ROLE_LABELS[inv.role] ?? inv.role}</TableCell>
                          <TableCell className="text-muted-foreground">{inv.full_name || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => void revokeInvite(inv.id)}>
                              Révoquer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Équipe</CardTitle>
            <CardDescription>
              Utilisateurs de votre organisation
              {isAdmin ? " — modifiez leur rôle ci-dessous" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetMsg && (
              <p
                className={
                  "mb-3 rounded-md border px-3 py-2 text-sm " +
                  (resetMsg.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-destructive/30 bg-destructive/10 text-destructive")
                }
              >
                {resetMsg.text}
              </p>
            )}
            {loadingColleagues ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    {isAdmin && <TableHead>Email</TableHead>}
                    <TableHead>Rôle</TableHead>
                    {isAdmin && <TableHead>Mot de passe</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colleagues.map((colleague) => (
                    <TableRow key={colleague.id}>
                      <TableCell>
                        {colleague.full_name}
                        {colleague.id === profile.id && (
                          <span className="text-muted-foreground"> (vous)</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-muted-foreground">{colleague.email || "—"}</TableCell>
                      )}
                      <TableCell>
                        {isAdmin && colleague.id !== profile.id ? (
                          <Select
                            items={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] ?? role }))}
                            value={colleague.role}
                            onValueChange={(role) => role && void updateRole(colleague.id, role)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role] ?? role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{ROLE_LABELS[colleague.role] ?? colleague.role}</Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void resetPassword(colleague)}
                            disabled={!colleague.email}
                          >
                            Réinitialiser
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Historique des connexions</CardTitle>
              <CardDescription>20 dernières connexions à votre organisation</CardDescription>
            </CardHeader>
            <CardContent>
              {loginEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune connexion enregistrée.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Date et heure</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginEvents.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>{ev.full_name || "—"}</TableCell>
                        <TableCell>{ROLE_LABELS[ev.role] ?? ev.role}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ev.logged_in_at).toLocaleString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
