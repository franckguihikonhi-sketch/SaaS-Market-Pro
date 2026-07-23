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
import { PackagePlus } from "lucide-react";
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
  initialType = "purchase_receipt",
  label = "Enregistrer un mouvement",
  variant,
  icon,
}: {
  warehouseId: string;
  products: Product[];
  onRecorded: () => void;
  initialType?: string;
  label?: string;
  variant?: "outline";
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState(initialType);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setType(initialType);
      setProductId("");
      setQuantity("");
      setReason("");
      setError(null);
    }
  }

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={variant} />}>
        {icon}
        {label}
      </DialogTrigger>
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

  // Stock EN TEMPS RÉEL : dès qu'une vente (ou tout mouvement) touche ce dépôt,
  // la quantité se met à jour sous les yeux du gestionnaire, sans rafraîchir.
  useEffect(() => {
    if (!warehouseId) return;
    const channel = supabase
      .channel(`stock-live-${warehouseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stocks", filter: `warehouse_id=eq.${warehouseId}` },
        (payload) => {
          const row = payload.new as { id?: string; product_id?: string; quantity?: number | string };
          if (!row?.id) return;
          setStocks((prev) => {
            const next = { id: row.id!, product_id: row.product_id!, quantity: Number(row.quantity) };
            return prev.some((s) => s.id === next.id)
              ? prev.map((s) => (s.id === next.id ? { ...s, quantity: next.quantity } : s))
              : [...prev, next];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stock_movements",
          filter: `warehouse_id=eq.${warehouseId}`,
        },
        (payload) => {
          const m = payload.new as Record<string, unknown>;
          const mv: Movement = {
            id: String(m.id),
            product_id: String(m.product_id),
            type: String(m.type),
            quantity: Number(m.quantity),
            previous_qty: Number(m.previous_qty),
            new_qty: Number(m.new_qty),
            reason: String(m.reason ?? ""),
            created_at: String(m.created_at),
          };
          setMovements((prev) => [mv, ...prev.filter((x) => x.id !== mv.id)].slice(0, 20));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [warehouseId]);

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
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <AppNav />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Stock
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Temps réel
                </span>
              </CardTitle>
              <CardDescription>Quantités et mouvements par dépôt — mises à jour en direct</CardDescription>
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
                <>
                  <RecordMovementDialog
                    warehouseId={warehouseId}
                    products={products}
                    onRecorded={loadWarehouseData}
                    initialType="purchase_receipt"
                    label="Entrée d'article (Achat)"
                    icon={<PackagePlus className="h-4 w-4" />}
                  />
                  <RecordMovementDialog
                    warehouseId={warehouseId}
                    products={products}
                    onRecorded={loadWarehouseData}
                    initialType="adjustment"
                    label="Autre mouvement"
                    variant="outline"
                  />
                </>
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
