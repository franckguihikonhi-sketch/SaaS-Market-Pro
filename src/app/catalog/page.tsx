"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type Category = { id: string; name: string; parent_id: string | null };
type Brand = { id: string; name: string };
type Unit = { id: string; code: string; label: string };

function CategoriesTab({ organizationId, canWrite }: { organizationId: string; canWrite: boolean }) {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("organization_id", organizationId)
      .order("name");
    setItems((data as Category[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase
      .from("categories")
      .insert({ organization_id: organizationId, name });
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    void load();
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form onSubmit={addCategory} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="cat-name">Nouvelle catégorie</Label>
            <Input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune catégorie.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function BrandsTab({ organizationId, canWrite }: { organizationId: string; canWrite: boolean }) {
  const [items, setItems] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("brands")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name");
    setItems((data as Brand[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  async function addBrand(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("brands").insert({ organization_id: organizationId, name });
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    void load();
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form onSubmit={addBrand} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="brand-name">Nouvelle marque</Label>
            <Input id="brand-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune marque.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function UnitsTab({ organizationId, canWrite }: { organizationId: string; canWrite: boolean }) {
  const [items, setItems] = useState<Unit[]>([]);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("units")
      .select("id, code, label")
      .eq("organization_id", organizationId)
      .order("code");
    setItems((data as Unit[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase
      .from("units")
      .insert({ organization_id: organizationId, code, label });
    if (error) {
      setError(error.message);
      return;
    }
    setCode("");
    setLabel("");
    void load();
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form onSubmit={addUnit} className="flex items-end gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit-code">Code</Label>
            <Input
              id="unit-code"
              required
              placeholder="CAR"
              className="w-24"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="unit-label">Libellé</Label>
            <Input
              id="unit-label"
              required
              placeholder="Carton"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune unité.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.code}</TableCell>
                <TableCell>{u.label}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function CatalogPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
    else if (profile?.role === "warehouse_keeper") router.push("/stock");
  }, [loading, session, profile, router]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const canWrite = ["admin", "manager", "super_admin"].includes(profile.role);

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AppNav />
        <Card>
          <CardHeader>
            <CardTitle>Catalogue</CardTitle>
            <CardDescription>Catégories, marques et unités de vente</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="categories">
              <TabsList>
                <TabsTrigger value="categories">Catégories</TabsTrigger>
                <TabsTrigger value="brands">Marques</TabsTrigger>
                <TabsTrigger value="units">Unités</TabsTrigger>
              </TabsList>
              <TabsContent value="categories" className="pt-4">
                <CategoriesTab organizationId={profile.organization_id} canWrite={canWrite} />
              </TabsContent>
              <TabsContent value="brands" className="pt-4">
                <BrandsTab organizationId={profile.organization_id} canWrite={canWrite} />
              </TabsContent>
              <TabsContent value="units" className="pt-4">
                <UnitsTab organizationId={profile.organization_id} canWrite={canWrite} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
