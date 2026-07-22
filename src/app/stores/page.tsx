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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type Store = { id: string; code: string; name: string; address: string; is_active: boolean };
type Warehouse = { id: string; code: string; name: string; store_id: string | null; is_active: boolean };

export default function StoresPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  const [whCode, setWhCode] = useState("");
  const [whName, setWhName] = useState("");
  const [whStoreId, setWhStoreId] = useState<string>("none");

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
  }, [loading, session, profile, router]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoadingData(true);
    const [{ data: s }, { data: w }] = await Promise.all([
      supabase
        .from("stores")
        .select("id, code, name, address, is_active")
        .eq("organization_id", profile.organization_id)
        .order("code"),
      supabase
        .from("warehouses")
        .select("id, code, name, store_id, is_active")
        .eq("organization_id", profile.organization_id)
        .order("code"),
    ]);
    setStores((s as Store[]) ?? []);
    setWarehouses((w as Warehouse[]) ?? []);
    setLoadingData(false);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  async function addStore(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    const { error } = await supabase.from("stores").insert({
      organization_id: profile.organization_id,
      code: storeCode,
      name: storeName,
      address: storeAddress,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setStoreCode("");
    setStoreName("");
    setStoreAddress("");
    void load();
  }

  async function addWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    const { error } = await supabase.from("warehouses").insert({
      organization_id: profile.organization_id,
      code: whCode,
      name: whName,
      store_id: whStoreId === "none" ? null : whStoreId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setWhCode("");
    setWhName("");
    setWhStoreId("none");
    void load();
  }

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const canWrite = ["admin", "manager", "super_admin"].includes(profile.role);

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AppNav />

        <Card>
          <CardHeader>
            <CardTitle>Magasins</CardTitle>
            <CardDescription>Points de vente de votre organisation</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canWrite && (
              <form onSubmit={addStore} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="store-code">Code</Label>
                  <Input id="store-code" required className="w-24" value={storeCode} onChange={(e) => setStoreCode(e.target.value)} />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="store-name">Nom</Label>
                  <Input id="store-name" required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="store-address">Adresse</Label>
                  <Input id="store-address" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
                </div>
                <Button type="submit">Ajouter</Button>
              </form>
            )}
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun magasin.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Adresse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dépôts</CardTitle>
            <CardDescription>Emplacements physiques de stock</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canWrite && (
              <form onSubmit={addWarehouse} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wh-code">Code</Label>
                  <Input id="wh-code" required className="w-24" value={whCode} onChange={(e) => setWhCode(e.target.value)} />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="wh-name">Nom</Label>
                  <Input id="wh-name" required value={whName} onChange={(e) => setWhName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Magasin</Label>
                  <Select
                    items={[{ value: "none", label: "Aucun" }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
                    value={whStoreId}
                    onValueChange={(v) => v && setWhStoreId(v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">Ajouter</Button>
              </form>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : warehouses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dépôt.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Magasin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.code}</TableCell>
                      <TableCell>{w.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {stores.find((s) => s.id === w.store_id)?.name ?? "—"}
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
