"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type Sale = { id: string; store_id: string; total: number; tax_total: number; created_at: string };
type SaleLine = { product_id: string; label: string; quantity: number; unit_price: number };
type Store = { id: string; name: string };
type Product = { id: string; label: string; min_stock: number };
type Stock = { product_id: string; quantity: number };

const cfaFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});
// Montant en francs CFA avec séparateur de milliers (ex. « 1 250 F CFA »).
function formatCFA(n: number) {
  return cfaFormatter.format(n);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date) {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 1));
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
    else if (profile?.role === "warehouse_keeper") router.push("/stock");
  }, [loading, session, profile, router]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoadingData(true);
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [{ data: s }, { data: st }, { data: p }, { data: stk }] = await Promise.all([
      supabase
        .from("sales")
        .select("id, store_id, total, tax_total, created_at")
        .eq("status", "completed")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").eq("organization_id", profile.organization_id),
      supabase.from("products").select("id, label, min_stock").eq("organization_id", profile.organization_id),
      supabase.from("stocks").select("product_id, quantity"),
    ]);
    setSales((s as Sale[]) ?? []);
    setStores((st as Store[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setStocks((stk as Stock[]) ?? []);

    const saleIds = (s as Sale[] | null)?.map((row) => row.id) ?? [];
    if (saleIds.length > 0) {
      const { data: sl } = await supabase
        .from("sale_lines")
        .select("product_id, label, quantity, unit_price")
        .in("sale_id", saleIds);
      setSaleLines((sl as SaleLine[]) ?? []);
    } else {
      setSaleLines([]);
    }
    setLoadingData(false);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const week = startOfWeek(new Date());
    const caToday = sales.filter((s) => new Date(s.created_at) >= today).reduce((sum, s) => sum + s.total, 0);
    const caWeek = sales.filter((s) => new Date(s.created_at) >= week).reduce((sum, s) => sum + s.total, 0);
    const tvaWeek = sales.filter((s) => new Date(s.created_at) >= week).reduce((sum, s) => sum + s.tax_total, 0);
    return { caToday, caWeek, tvaWeek, salesToday: sales.filter((s) => new Date(s.created_at) >= today).length };
  }, [sales]);

  const topProducts = useMemo(() => {
    const byProduct = new Map<string, { label: string; revenue: number; quantity: number }>();
    for (const line of saleLines) {
      const cur = byProduct.get(line.product_id) ?? { label: line.label, revenue: 0, quantity: 0 };
      cur.revenue += line.quantity * line.unit_price;
      cur.quantity += line.quantity;
      byProduct.set(line.product_id, cur);
    }
    return Array.from(byProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [saleLines]);

  const lowStock = useMemo(() => {
    const totalByProduct = new Map<string, number>();
    for (const s of stocks) {
      totalByProduct.set(s.product_id, (totalByProduct.get(s.product_id) ?? 0) + s.quantity);
    }
    return products
      .map((p) => ({ ...p, quantity: totalByProduct.get(p.id) ?? 0 }))
      .filter((p) => p.min_stock > 0 && p.quantity < p.min_stock);
  }, [products, stocks]);

  function exportJournal() {
    const rows: (string | number)[][] = [
      ["Date", "Magasin", "Sous-total TTC (CFA)", "TVA (CFA)", "Total (CFA)"],
      ...sales.map((s) => [
        new Date(s.created_at).toLocaleString("fr-FR"),
        stores.find((st) => st.id === s.store_id)?.name ?? "",
        Math.round(s.total - s.tax_total),
        Math.round(s.tax_total),
        Math.round(s.total),
      ]),
    ];
    downloadCsv(`journal-ventes-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <AppNav />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>CA aujourd&apos;hui</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{formatCFA(stats.caToday)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ventes aujourd&apos;hui</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{stats.salesToday}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>CA cette semaine</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{formatCFA(stats.caWeek)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>TVA collectée (semaine)</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{formatCFA(stats.tvaWeek)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top ventes (30 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur cette période.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Quantité vendue</TableHead>
                    <TableHead>Chiffre d&apos;affaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p) => (
                    <TableRow key={p.label}>
                      <TableCell>{p.label}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell className="tabular-nums">{formatCFA(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes de stock faible</CardTitle>
            <CardDescription>Articles sous leur seuil minimum (tous dépôts confondus)</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune alerte.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Stock actuel</TableHead>
                    <TableHead>Seuil minimum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.label}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{p.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.min_stock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Journal des ventes</CardTitle>
              <CardDescription>30 derniers jours</CardDescription>
            </div>
            <Button variant="outline" onClick={exportJournal} disabled={sales.length === 0}>
              Exporter en CSV
            </Button>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, 20).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.created_at).toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {stores.find((st) => st.id === s.store_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCFA(s.total)}</TableCell>
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
