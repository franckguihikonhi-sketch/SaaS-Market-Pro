"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, Plus, Users, Wifi, Wrench } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/use-session";
import { useOnlineMembers } from "@/lib/use-presence";
import { useMaintenance } from "@/lib/use-maintenance";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Gérant",
  cashier: "Caissier(ère)",
  warehouse_keeper: "Gestionnaire de stock",
  accountant: "Comptable",
};

type OrgRow = {
  organization_id: string;
  organization_name: string;
  created_at: string;
  user_count: number;
  max_seats: number;
};

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleString("fr-FR") : "—";
}

// Création d'une entreprise cliente par le propriétaire de la plateforme :
// nom + nombre de postes + code d'accès pour son premier administrateur.
function NewOrgDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("3");
  const [adminName, setAdminName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSeats("3");
    setAdminName("");
    setCode(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: name,
      p_seats: Number(seats) || 3,
      p_admin_name: adminName,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    const row = (data as { organization_id: string; invite_code: string }[] | null)?.[0];
    setCode(row?.invite_code ?? null);
    onCreated();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Nouvelle entreprise
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle entreprise cliente</DialogTitle>
          <DialogDescription>
            Créez l&apos;entreprise et son nombre de postes. Un code d&apos;accès sera généré pour son
            premier administrateur.
          </DialogDescription>
        </DialogHeader>

        {code ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Entreprise créée ✅ Communiquez ce <strong>code d&apos;accès</strong> à
              l&apos;administrateur de <strong>{name}</strong> : il s&apos;inscrit sur la page
              d&apos;inscription avec ce code.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="font-mono text-2xl font-bold tracking-widest text-emerald-800">{code}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(code).catch(() => {})}
              >
                Copier
              </Button>
            </div>
            <Button type="button" onClick={() => setOpen(false)}>
              Terminé
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Nom de l&apos;entreprise</Label>
              <Input id="org-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-seats">Nombre de postes</Label>
              <Input
                id="org-seats"
                type="number"
                min="1"
                required
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-admin">Nom de l&apos;administrateur (optionnel)</Label>
              <Input id="org-admin" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Création…" : "Créer l'entreprise"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const { enter } = useMaintenance();
  // Présence : on ignore le super_admin (le propriétaire n'est pas un agent client).
  const online = useOnlineMembers().filter((m) => m.role !== "super_admin");

  async function openMaintenance(orgId: string) {
    // enter() recharge la page sur le tableau de bord de l'entreprise ouverte.
    await enter(orgId);
  }
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const isPlatformOwner = profile?.role === "super_admin";

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile && profile.role !== "super_admin") router.push("/dashboard");
  }, [loading, session, profile, router]);

  const loadOrgs = useCallback(async () => {
    if (!isPlatformOwner) return;
    const { data } = await supabase.rpc("platform_overview");
    setOrgs((data as OrgRow[]) ?? []);
    setLoadingData(false);
  }, [isPlatformOwner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void loadOrgs();
    const id = setInterval(() => void loadOrgs(), 30000);
    return () => clearInterval(id);
  }, [loadOrgs]);

  const orgName = useCallback(
    (id: string) => orgs.find((o) => o.organization_id === id)?.organization_name ?? "—",
    [orgs]
  );

  async function saveSeats(orgId: string, seats: number) {
    if (!Number.isFinite(seats) || seats < 1) return;
    await supabase.rpc("set_org_seats", { p_org: orgId, p_seats: Math.round(seats) });
    void loadOrgs();
  }

  const agents = useMemo(
    () =>
      [...online].sort(
        (a, b) =>
          orgName(a.organization_id).localeCompare(orgName(b.organization_id)) ||
          a.full_name.localeCompare(b.full_name)
      ),
    [online, orgName]
  );

  if (loading || !session || !profile || !isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const totalUsers = orgs.reduce((s, o) => s + Number(o.user_count), 0);
  const connectedFor = (orgId: string) => online.filter((m) => m.organization_id === orgId).length;

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <AppNav />

        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Console plateforme</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de toutes les entreprises clientes — présence en temps réel.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Entreprises" value={orgs.length} icon={<Building2 className="h-4 w-4" />} />
          <StatCard title="Utilisateurs" value={totalUsers} icon={<Users className="h-4 w-4" />} />
          <StatCard
            title="Agents connectés"
            value={
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                {online.length}
              </span>
            }
            tone="positive"
            icon={<Wifi className="h-4 w-4" />}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Entreprises</CardTitle>
              <CardDescription>Chaque entreprise est totalement isolée des autres.</CardDescription>
            </div>
            <NewOrgDialog onCreated={loadOrgs} />
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune entreprise.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead className="text-right">Postes (utilisés / max)</TableHead>
                    <TableHead className="text-right">Connectés</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead className="text-right">Maintenance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((o) => (
                    <TableRow key={o.organization_id}>
                      <TableCell className="font-medium">{o.organization_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={cn(
                              "font-medium",
                              Number(o.user_count) >= o.max_seats && "text-red-600"
                            )}
                          >
                            {o.user_count}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <Input
                            type="number"
                            min="1"
                            key={`${o.organization_id}-${o.max_seats}`}
                            defaultValue={o.max_seats}
                            onBlur={(e) => void saveSeats(o.organization_id, Number(e.target.value))}
                            className="h-7 w-16 text-right"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {connectedFor(o.organization_id) > 0 ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {connectedFor(o.organization_id)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void openMaintenance(o.organization_id)}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Ouvrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              Agents connectés maintenant
            </CardTitle>
            <CardDescription>En temps réel, toutes entreprises confondues.</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Personne connecté pour l&apos;instant.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Depuis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{orgName(a.organization_id)}</TableCell>
                      <TableCell>{a.full_name}</TableCell>
                      <TableCell>{ROLE_LABELS[a.role] ?? a.role}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(a.online_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
