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
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
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
  warehouse_keeper: "Magasinier",
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

export default function PlatformPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const { enter } = useMaintenance();
  // Présence : on ignore le super_admin (le propriétaire n'est pas un agent client).
  const online = useOnlineMembers().filter((m) => m.role !== "super_admin");

  async function openMaintenance(orgId: string, orgName: string) {
    await enter(orgId, orgName);
    router.push("/dashboard");
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
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Entreprises</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{orgs.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Utilisateurs</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{totalUsers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Agents connectés</CardDescription>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                {online.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entreprises</CardTitle>
            <CardDescription>Chaque entreprise est totalement isolée des autres.</CardDescription>
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
                          onClick={() =>
                            void openMaintenance(o.organization_id, o.organization_name)
                          }
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
