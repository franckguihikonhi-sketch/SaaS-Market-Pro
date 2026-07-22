"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type Warehouse = { id: string; code: string; name: string };
type Product = { id: string; label: string; code: string; base_unit_id: string };
type Unit = { id: string; code: string; label: string };
type ProductUnit = { id: string; product_id: string; unit_id: string; coefficient_to_base: number };
type StockRow = { id: string; product_id: string; quantity: number };
type Movement = {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason: string;
  created_at: string;
};

function UnitBreakdown({ parts, signed }: { parts: { label: string; qty: number }[]; signed?: boolean }) {
  return (
    <>
      {parts.map((part, i) => {
        const value = Number(part.qty.toFixed(6));
        const text = signed && value > 0 ? `+${value}` : String(value);
        const colorClass = signed ? (value < 0 ? "text-destructive" : "text-emerald-600") : "";
        return (
          <span key={part.label}>
            {i > 0 && " · "}
            <span className={i === 0 ? colorClass : "text-muted-foreground"}>
              {text} {part.label}
            </span>
          </span>
        );
      })}
    </>
  );
}

const MOVEMENT_TYPES = [
  { value: "purchase_receipt", label: "Réception achat (+)" },
  { value: "adjustment", label: "Ajustement (+/-)" },
  { value: "breakage", label: "Casse (-)" },
  { value: "loss", label: "Perte (-)" },
  { value: "theft", label: "Vol (-)" },
  { value: "supplier_return", label: "Retour fournisseur (-)" },
  { value: "customer_return", label: "Retour client (+)" },
  { value: "transfer_in", label: "Transfert entrant (+)" },
  { value: "transfer_out", label: "Transfert sortant (-)" },
  { value: "inventory_count", label: "Inventaire (=+/-)" },
];

function RecordMovementDialog({
  warehouseId,
  products,
  onRecorded,
}: {
  warehouseId: string;
  products: Product[];
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("purchase_receipt");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!productId || !qty || qty <= 0) {
      setError("Choisissez un article et une quantité valide (> 0).");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("record_stock_movement", {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_type: type,
      p_quantity: qty,
      p_reason: reason,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setProductId("");
    setQuantity("");
    setReason("");
    setOpen(false);
    onRecorded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Enregistrer un mouvement</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mouvement de stock</DialogTitle>
          <DialogDescription>La quantité est toujours saisie en valeur positive.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Article</Label>
            <Select
              items={products.map((p) => ({ value: p.id, label: p.label }))}
              value={productId}
              onValueChange={(v) => v && setProductId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un article" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Type de mouvement</Label>
            <Select items={MOVEMENT_TYPES} value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-qty">Quantité</Label>
            <Input id="m-qty" type="number" min="0" step="0.000001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-reason">Motif (optionnel)</Label>
            <Input id="m-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StockPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
  }, [loading, session, profile, router]);

  const loadBase = useCallback(async () => {
    if (!profile) return;
    const [{ data: w }, { data: p }, { data: u }, { data: pu }] = await Promise.all([
      supabase.from("warehouses").select("id, code, name").eq("organization_id", profile.organization_id).order("code"),
      supabase
        .from("products")
        .select("id, label, code, base_unit_id")
        .eq("organization_id", profile.organization_id)
        .order("label"),
      supabase.from("units").select("id, code, label").eq("organization_id", profile.organization_id),
      supabase.from("product_units").select("id, product_id, unit_id, coefficient_to_base"),
    ]);
    setWarehouses((w as Warehouse[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setProductUnits((pu as ProductUnit[]) ?? []);
    if (w && w.length > 0) setWarehouseId((current) => current || w[0].id);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void loadBase();
  }, [loadBase]);

  const loadWarehouseData = useCallback(async () => {
    if (!warehouseId) {
      setStocks([]);
      setMovements([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from("stocks").select("id, product_id, quantity").eq("warehouse_id", warehouseId),
      supabase
        .from("stock_movements")
        .select("id, product_id, type, quantity, previous_qty, new_qty, reason, created_at")
        .eq("warehouse_id", warehouseId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setStocks((s as StockRow[]) ?? []);
    setMovements((m as Movement[]) ?? []);
    setLoadingData(false);
  }, [warehouseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when warehouse changes
    void loadWarehouseData();
  }, [loadWarehouseData]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const canWrite = ["admin", "manager", "super_admin", "warehouse_keeper"].includes(profile.role);
  const productLabel = (id: string) => products.find((p) => p.id === id)?.label ?? "—";
  const unitCode = (id: string) => {
    const u = units.find((u) => u.id === id);
    return u?.code || u?.label || "—";
  };
  function unitBreakdown(productId: string, baseQty: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return [{ label: "—", qty: baseQty }];
    const parts = [{ label: unitCode(product.base_unit_id), qty: baseQty }];
    for (const pu of productUnits.filter((pu) => pu.product_id === productId)) {
      parts.push({ label: unitCode(pu.unit_id), qty: baseQty / pu.coefficient_to_base });
    }
    return parts;
  }

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <AppNav />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Stock</CardTitle>
              <CardDescription>Quantités et mouvements par dépôt</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {warehouses.length > 0 && (
                <Select
                  items={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  value={warehouseId}
                  onValueChange={(v) => v && setWarehouseId(v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canWrite && warehouseId && products.length > 0 && (
                <RecordMovementDialog warehouseId={warehouseId} products={products} onRecorded={loadWarehouseData} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {warehouses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Créez d&apos;abord un dépôt dans la page Magasins.
              </p>
            ) : loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : stocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun stock enregistré dans ce dépôt.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Quantité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{productLabel(s.product_id)}</TableCell>
                      <TableCell>
                        <UnitBreakdown parts={unitBreakdown(s.product_id, s.quantity)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {warehouseId && movements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mouvements récents</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Après</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{productLabel(m.product_id)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{m.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <UnitBreakdown parts={unitBreakdown(m.product_id, m.quantity)} signed />
                      </TableCell>
                      <TableCell>
                        <UnitBreakdown parts={unitBreakdown(m.product_id, m.new_qty)} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("fr-FR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
