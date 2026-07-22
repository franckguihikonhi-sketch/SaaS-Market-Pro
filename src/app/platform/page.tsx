"use client";

import { useCallback, useEffect, useState } from "react";
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
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

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
  active_count: number;
  last_activity: string | null;
};
type AgentRow = {
  organization_name: string;
  full_name: string;
  role: string;
  last_seen: string;
};

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleString("fr-FR") : "—";
}

export default function PlatformPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const isPlatformOwner = profile?.role === "super_admin";

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile && profile.role !== "super_admin") router.push("/dashboard");
  }, [loading, session, profile, router]);

  const load = useCallback(async () => {
    if (!isPlatformOwner) return;
    const [{ data: o }, { data: a }] = await Promise.all([
      supabase.rpc("platform_overview"),
      supabase.rpc("platform_agents"),
    ]);
    setOrgs((o as OrgRow[]) ?? []);
    setAgents((a as AgentRow[]) ?? []);
    setLoadingData(false);
  }, [isPlatformOwner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
    const id = setInterval(() => void load(), 20000); // rafraîchit toutes les 20 s
    return () => clearInterval(id);
  }, [load]);

  if (loading || !session || !profile || !isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const totalUsers = orgs.reduce((s, o) => s + Number(o.user_count), 0);
  const totalActive = orgs.reduce((s, o) => s + Number(o.active_count), 0);

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <AppNav />

        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Console plateforme</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de toutes les entreprises clientes (mise à jour automatique).
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
                {totalActive}
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
                    <TableHead className="text-right">Utilisateurs</TableHead>
                    <TableHead className="text-right">Connectés</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead>Créée le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((o) => (
                    <TableRow key={o.organization_id}>
                      <TableCell className="font-medium">{o.organization_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.user_count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(o.active_count) > 0 ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {o.active_count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(o.last_activity)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
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
            <CardDescription>Utilisateurs actifs sur les 5 dernières minutes, toutes entreprises.</CardDescription>
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
                    <TableHead>Vu à</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a, i) => (
                    <TableRow key={`${a.organization_name}-${a.full_name}-${i}`}>
                      <TableCell className="font-medium">{a.organization_name}</TableCell>
                      <TableCell>{a.full_name}</TableCell>
                      <TableCell>{ROLE_LABELS[a.role] ?? a.role}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(a.last_seen).toLocaleTimeString("fr-FR", {
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
