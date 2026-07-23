"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
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

type Supplier = { id: string; name: string; balance?: number };
type Warehouse = { id: string; name: string };
type Product = { id: string; label: string; base_unit_id: string; purchase_price: number };
type Unit = { id: string; code: string; label: string };
type ProductUnit = { id: string; product_id: string; unit_id: string; coefficient_to_base: number };

type PurchaseLine = { key: string; productId: string; productUnitId: string; quantity: string; unitPrice: string };

type PurchaseRow = {
  id: string;
  created_at: string;
  reference: string;
  total: number;
  paid: number;
  supplier: { name: string } | null;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Carte" },
  { value: "check", label: "Chèque" },
];

// Formatage CFA avec séparateur de milliers.
function fmtMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.round(Number(n) || 0))
    .replace(/ /g, " ");
}

function newLine(): PurchaseLine {
  return { key: crypto.randomUUID(), productId: "", productUnitId: "", quantity: "", unitPrice: "" };
}

function PayDialog({
  purchase,
  onPaid,
}: {
  purchase: PurchaseRow;
  onPaid: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = Number(purchase.total) - Number(purchase.paid);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Montant invalide.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("add_purchase_payment", {
      p_purchase: purchase.id,
      p_amount: amt,
      p_method: method,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAmount("");
    setOpen(false);
    onPaid();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount(String(Math.max(0, remaining)));
          setMethod("cash");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Régler</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Règlement de l&apos;achat</DialogTitle>
          <DialogDescription>Reste dû : {fmtMoney(remaining)} CFA</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-amount">Montant</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Mode de règlement</Label>
            <Select items={PAYMENT_METHODS} value={method} onValueChange={(v) => v && setMethod(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer le règlement"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function methodLabel(m: string) {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
}

function PurchaseDetailDialog({ purchase }: { purchase: PurchaseRow }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<{ id: string; label: string; quantity: number; unit_price: number; line_total: number }[]>([]);
  const [payments, setPayments] = useState<{ id: string; amount: number; method: string; paid_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const remaining = Number(purchase.total) - Number(purchase.paid);

  async function load() {
    setLoading(true);
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from("purchase_lines").select("id, label, quantity, unit_price, line_total").eq("purchase_id", purchase.id),
      supabase
        .from("purchase_payments")
        .select("id, amount, method, paid_at")
        .eq("purchase_id", purchase.id)
        .order("paid_at", { ascending: true }),
    ]);
    setLines((l as typeof lines) ?? []);
    setPayments((p as typeof payments) ?? []);
    setLoading(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>Détails</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Achat — {purchase.supplier?.name ?? "Sans fournisseur"}</DialogTitle>
          <DialogDescription>
            {new Date(purchase.created_at).toLocaleString("fr-FR")}
            {purchase.reference ? ` · Réf. ${purchase.reference}` : ""}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Articles</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(l.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.unit_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.line_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total achat</span>
                <span className="font-semibold tabular-nums">{fmtMoney(purchase.total)} CFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payé</span>
                <span className="font-semibold tabular-nums text-emerald-700">{fmtMoney(purchase.paid)} CFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reste dû</span>
                <span className={"font-semibold tabular-nums " + (remaining > 0.01 ? "text-amber-700" : "text-emerald-700")}>
                  {fmtMoney(remaining)} CFA
                </span>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Règlements</p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun règlement pour l&apos;instant.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((pay) => (
                      <TableRow key={pay.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(pay.paid_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>{methodLabel(pay.method)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(pay.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PurchasesPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([newLine()]);
  const [paidNow, setPaidNow] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [newSupplier, setNewSupplier] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    else if (profile?.role === "cashier") router.push("/pos");
  }, [loading, session, profile, router]);

  const loadBase = useCallback(async () => {
    if (!profile) return;
    const org = profile.organization_id;
    const [{ data: s }, { data: w }, { data: p }, { data: u }, { data: pu }] = await Promise.all([
      supabase.from("suppliers").select("id, name, balance").eq("organization_id", org).order("name"),
      supabase.from("warehouses").select("id, name").eq("organization_id", org).order("name"),
      supabase
        .from("products")
        .select("id, label, base_unit_id, purchase_price")
        .eq("organization_id", org)
        .order("label"),
      supabase.from("units").select("id, code, label").eq("organization_id", org),
      supabase.from("product_units").select("id, product_id, unit_id, coefficient_to_base"),
    ]);
    setSuppliers((s as Supplier[]) ?? []);
    setWarehouses((w as Warehouse[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setProductUnits((pu as ProductUnit[]) ?? []);
    if (w && w.length > 0) setWarehouseId((cur) => cur || w[0].id);
  }, [profile]);

  const loadPurchases = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("purchases")
      .select("id, created_at, reference, total, paid, supplier:suppliers(name)")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setPurchases((data as unknown as PurchaseRow[]) ?? []);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void loadBase();
    void loadPurchases();
  }, [loadBase, loadPurchases]);

  const unitLabel = useCallback(
    (id: string) => {
      const u = units.find((x) => x.id === id);
      return u?.code || u?.label || "—";
    },
    [units]
  );

  // Options d'unité d'un article : unité de base + unités d'achat définies.
  const unitOptions = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return [];
      const opts = [{ value: "", label: `${unitLabel(product.base_unit_id)} (base)` }];
      for (const pu of productUnits.filter((x) => x.product_id === productId)) {
        opts.push({ value: pu.id, label: `${unitLabel(pu.unit_id)} (×${pu.coefficient_to_base})` });
      }
      return opts;
    },
    [products, productUnits, unitLabel]
  );

  function updateLine(key: string, patch: Partial<PurchaseLine>) {
    setLines((cur) =>
      cur.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Quand on choisit l'article, on pré-remplit le prix d'achat connu.
        if (patch.productId && patch.productId !== l.productId) {
          const prod = products.find((p) => p.id === patch.productId);
          next.productUnitId = "";
          next.unitPrice = prod && prod.purchase_price > 0 ? String(prod.purchase_price) : "";
        }
        return next;
      })
    );
  }

  const formTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const q = Number(l.quantity);
        const p = Number(l.unitPrice);
        return sum + (q > 0 && p >= 0 ? q * p : 0);
      }, 0),
    [lines]
  );

  async function addSupplier() {
    const name = newSupplier.trim();
    if (!name) return;
    const { data, error } = await supabase.rpc("create_supplier", { p_name: name, p_phone: "" });
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    const created = data as Supplier;
    setSuppliers((cur) => [...cur, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSupplierId(created.id);
    setNewSupplier("");
  }

  async function submitPurchase() {
    setMsg(null);
    if (!warehouseId) {
      setMsg({ text: "Choisissez un dépôt de réception.", ok: false });
      return;
    }
    const payload = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        product_id: l.productId,
        product_unit_id: l.productUnitId || null,
        quantity: Number(l.quantity),
        unit_price: Number(l.unitPrice) || 0,
      }));
    if (payload.length === 0) {
      setMsg({ text: "Ajoutez au moins une ligne (article + quantité).", ok: false });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("record_purchase", {
      p_supplier_id: supplierId || null,
      p_warehouse_id: warehouseId,
      p_reference: reference,
      p_note: note,
      p_lines: payload,
      p_paid_now: Number(paidNow) || 0,
      p_payment_method: paymentMethod,
    });
    setBusy(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    setReference("");
    setNote("");
    setLines([newLine()]);
    setPaidNow("");
    setMsg({ text: "Achat enregistré — le stock a été mis à jour.", ok: true });
    void loadPurchases();
  }

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const totalAchats = purchases.reduce((s, p) => s + Number(p.total), 0);
  const totalDu = purchases.reduce((s, p) => s + (Number(p.total) - Number(p.paid)), 0);

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <AppNav />

        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <ShoppingBag className="h-6 w-6" />
            Achats
          </h1>
          <p className="text-sm text-muted-foreground">
            Enregistrez vos entrées d&apos;articles avec le fournisseur, le détail et le suivi des paiements.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Achats</CardDescription>
              <CardTitle className="text-lg sm:text-2xl">{purchases.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total achats</CardDescription>
              <CardTitle className="text-lg tabular-nums sm:text-2xl">{fmtMoney(totalAchats)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={totalDu > 0 ? "border-amber-300" : undefined}>
            <CardHeader className="pb-2">
              <CardDescription>Reste dû (fournisseurs)</CardDescription>
              <CardTitle
                className={
                  "text-lg tabular-nums sm:text-2xl " + (totalDu > 0 ? "text-amber-700" : "text-emerald-700")
                }
              >
                {fmtMoney(totalDu)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nouvel achat</CardTitle>
            <CardDescription>
              La réception met automatiquement le stock à jour. Le reste dû est suivi par fournisseur.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {msg && (
              <p
                className={
                  "rounded-md border px-3 py-2 text-sm " +
                  (msg.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-destructive/30 bg-destructive/10 text-destructive")
                }
              >
                {msg.text}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Fournisseur</Label>
                <Select
                  items={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={supplierId}
                  onValueChange={(v) => setSupplierId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    placeholder="Nouveau fournisseur…"
                    className="h-8"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => void addSupplier()}>
                    Ajouter
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Dépôt de réception</Label>
                <Select
                  items={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  value={warehouseId}
                  onValueChange={(v) => v && setWarehouseId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un dépôt" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ref">N° facture / bon de livraison</Label>
                <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optionnel" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="note">Note</Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionnel" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Articles achetés</Label>
              <div className="flex flex-col gap-2">
                {lines.map((line) => (
                  <div key={line.key} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_0.9fr_1fr_1fr_auto] sm:items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Article</span>
                      <Select
                        items={products.map((p) => ({ value: p.id, label: p.label }))}
                        value={line.productId}
                        onValueChange={(v) => v && updateLine(line.key, { productId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir" />
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
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Unité</span>
                      <Select
                        items={unitOptions(line.productId)}
                        value={line.productUnitId}
                        onValueChange={(v) => updateLine(line.key, { productUnitId: v ?? "" })}
                        disabled={!line.productId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unité" />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOptions(line.productId).map((o) => (
                            <SelectItem key={o.value || "base"} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Quantité</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.000001"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Prix unitaire (CFA)</span>
                      <Input
                        type="number"
                        min="0"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Total ligne</span>
                      <div className="flex h-8 items-center justify-end rounded-md bg-slate-50 px-2 text-sm font-semibold tabular-nums">
                        {fmtMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setLines((cur) => (cur.length > 1 ? cur.filter((l) => l.key !== line.key) : cur))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((cur) => [...cur, newLine()])}>
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </Button>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Payé maintenant (CFA)</span>
                  <Input
                    type="number"
                    min="0"
                    value={paidNow}
                    onChange={(e) => setPaidNow(e.target.value)}
                    placeholder="0"
                    className="w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Mode de règlement</span>
                  <Select items={PAYMENT_METHODS} value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total achat</p>
                <p className="text-2xl font-bold tabular-nums">{fmtMoney(formTotal)} CFA</p>
              </div>
            </div>

            <Button
              className="self-end bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void submitPurchase()}
              disabled={busy || warehouses.length === 0}
            >
              {busy ? "Enregistrement…" : "Enregistrer l'achat"}
            </Button>
            {warehouses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun dépôt : demandez à l&apos;administrateur d&apos;en créer un (page Magasins).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique des achats</CardTitle>
            <CardDescription>Suivi des paiements — payé / reste dû.</CardDescription>
          </CardHeader>
          <CardContent>
            {purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun achat enregistré.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Reste</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => {
                    const remaining = Number(p.total) - Number(p.paid);
                    const paidFull = remaining <= 0.01;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="font-medium">{p.supplier?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.reference || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(p.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(p.paid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(remaining)}</TableCell>
                        <TableCell>
                          {paidFull ? (
                            <Badge variant="secondary" className="text-emerald-700">Payé</Badge>
                          ) : Number(p.paid) > 0 ? (
                            <Badge variant="secondary" className="text-amber-700">Partiel</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-destructive">Impayé</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <PurchaseDetailDialog purchase={p} />
                            {!paidFull && <PayDialog purchase={p} onPaid={loadPurchases} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
