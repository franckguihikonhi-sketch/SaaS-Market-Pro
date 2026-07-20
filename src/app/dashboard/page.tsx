"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type OrgProfile = Profile & { organization?: { name: string } | null };

export default function DashboardPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [organizationName, setOrganizationName] = useState<string>("");
  const [colleagues, setColleagues] = useState<OrgProfile[]>([]);
  const [loadingColleagues, setLoadingColleagues] = useState(true);

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  const loadOrgData = useCallback(async () => {
    if (!profile) return;
    setLoadingColleagues(true);
    const [{ data: org }, { data: profiles }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", profile.organization_id).single(),
      supabase
        .from("profiles")
        .select("id, organization_id, full_name, role")
        .eq("organization_id", profile.organization_id)
        .order("full_name"),
    ]);
    setOrganizationName(org?.name ?? "");
    setColleagues((profiles as OrgProfile[]) ?? []);
    setLoadingColleagues(false);
  }, [profile]);

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
