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

const ROLES = ["super_admin", "admin", "manager", "cashier", "warehouse_keeper", "accountant"];

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

type OrgProfile = Profile & { organization?: { name: string } | null };
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
  const [organizationName, setOrganizationName] = useState<string>("");
  const [colleagues, setColleagues] = useState<OrgProfile[]>([]);
  const [loadingColleagues, setLoadingColleagues] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteRole, setInviteRole] = useState("cashier");
  const [inviteName, setInviteName] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
  }, [loading, session, profile, router]);

  const loadOrgData = useCallback(async () => {
    if (!profile) return;
    setLoadingColleagues(true);
    const [{ data: org }, { data: profiles }, { data: invites }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", profile.organization_id).single(),
      supabase
        .from("profiles")
        .select("id, organization_id, full_name, role")
        .eq("organization_id", profile.organization_id)
        .order("full_name"),
      supabase
        .from("invitations")
        .select("id, code, role, full_name, used_by, created_at")
        .is("used_by", null)
        .order("created_at", { ascending: false }),
    ]);
    setOrganizationName(org?.name ?? "");
    setColleagues((profiles as OrgProfile[]) ?? []);
    setInvitations((invites as Invitation[]) ?? []);
    setLoadingColleagues(false);
  }, [profile]);

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
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AppNav />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{organizationName || "Market-Pro"}</h1>
            <p className="text-muted-foreground">
              Connecté en tant que {profile.full_name} — <Badge variant="secondary">{profile.role}</Badge>
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Se déconnecter
          </Button>
        </div>

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
            {loadingColleagues ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Rôle</TableHead>
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
                      <TableCell>
                        {isAdmin && colleague.id !== profile.id ? (
                          <Select
                            items={ROLES.map((role) => ({ value: role, label: role }))}
                            value={colleague.role}
                            onValueChange={(role) => role && void updateRole(colleague.id, role)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{colleague.role}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
