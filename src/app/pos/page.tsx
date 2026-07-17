"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Store = { id: string; name: string };
type Warehouse = { id: string; name: string; store_id: string | null };
type Unit = { id: string; label: string };
type Product = {
  id: string;
  code: string;
  barcode: string | null;
  label: string;
  base_unit_id: string;
  sale_price: number;
  tax_rate: number;
  status: string;
};
type ProductUnit = {
  id: string;
  product_id: string;
  unit_id: string;
  coefficient_to_base: number;
  barcode: string | null;
};

type TicketLine = {
  key: string;
  product_id: string;
  product_unit_id: string | null;
  label: string;
  unitLabel: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

type HeldSale = { id: string; total: number; created_at: string };

type Receipt = {
  id: string;
  organizationName: string;
  storeName: string;
  createdAt: string;
  lines: { label: string; unitLabel: string; quantity: number; unit_price: number }[];
  subtotal: number;
  tax: number;
  total: number;
};

export default function PosPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();

  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [storeId, setStoreId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const [query, setQuery] = useState("");
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  const loadBase = useCallback(async () => {
    if (!profile) return;
    const [{ data: org }, { data: s }, { data: w }, { data: u }, { data: p }, { data: pu }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", profile.organization_id).single(),
      supabase.from("stores").select("id, name").eq("organization_id", profile.organization_id).order("name"),
      supabase.from("warehouses").select("id, name, store_id").eq("organization_id", profile.organization_id).order("name"),
      supabase.from("units").select("id, label").eq("organization_id", profile.organization_id),
      supabase
        .from("products")
        .select("id, code, barcode, label, base_unit_id, sale_price, tax_rate, status")
        .eq("organization_id", profile.organization_id)
        .eq("status", "active")
        .order("label"),
      supabase.from("product_units").select("id, product_id, unit_id, coefficient_to_base, barcode"),
    ]);
    setOrganizationName(org?.name ?? "");
    setStores((s as Store[]) ?? []);
    setWarehouses((w as Warehouse[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setProductUnits((pu as ProductUnit[]) ?? []);
    if (s && s.length > 0) setStoreId((cur) => cur || s[0].id);
    if (w && w.length > 0) setWarehouseId((cur) => cur || w[0].id);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const unitLabel = useCallback(
    (id: string) => units.find((u) => u.id === id)?.label ?? "—",
    [units]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        if (p.code.toLowerCase() === q || p.barcode?.toLowerCase() === q) return true;
        const altBarcodeMatch = productUnits.some(
          (pu) => pu.product_id === p.id && pu.barcode?.toLowerCase() === q
        );
        if (altBarcodeMatch) return true;
        return p.label.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [query, products, productUnits]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const byCode = products.find((p) => p.code.toLowerCase() === q || p.barcode?.toLowerCase() === q);
    if (byCode) return { product: byCode, productUnitId: null as string | null };
    const altUnit = productUnits.find((pu) => pu.barcode?.toLowerCase() === q);
    if (altUnit) {
      const product = products.find((p) => p.id === altUnit.product_id);
      if (product) return { product, productUnitId: altUnit.id };
    }
    return null;
  }, [query, products, productUnits]);

  function addLine(product: Product, productUnitId: string | null) {
    const coeff = productUnitId
      ? productUnits.find((pu) => pu.id === productUnitId)?.coefficient_to_base ?? 1
      : 1;
    const label = productUnitId ? unitLabel(productUnits.find((pu) => pu.id === productUnitId)?.unit_id ?? "") : unitLabel(product.base_unit_id);
    setTicket((cur) => {
      const existing = cur.find((l) => l.product_id === product.id && l.product_unit_id === productUnitId);
      if (existing) {
        return cur.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...cur,
        {
          key: crypto.randomUUID(),
          product_id: product.id,
          product_unit_id: productUnitId,
          label: product.label,
          unitLabel: label,
          quantity: 1,
          unit_price: product.sale_price * coeff,
          tax_rate: product.tax_rate,
        },
      ];
    });
    setQuery("");
    setError(null);
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (exactMatch) {
      addLine(exactMatch.product, exactMatch.productUnitId);
    } else if (matches.length === 1) {
      addLine(matches[0], null);
    }
  }

  function updateLine(key: string, patch: Partial<TicketLine>) {
    setTicket((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setTicket((cur) => cur.filter((l) => l.key !== key));
  }

  function clearTicket() {
    setTicket([]);
    setError(null);
    setMessage(null);
  }

  const productUnitsFor = useCallback(
    (productId: string) => productUnits.filter((pu) => pu.product_id === productId),
    [productUnits]
  );

  const totals = useMemo(() => {
    const subtotal = ticket.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
    const tax = ticket.reduce((sum, l) => sum + (l.quantity * l.unit_price * l.tax_rate) / 100, 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [ticket]);

  async function submitTicket(status: "held" | "completed") {
    if (ticket.length === 0) {
      setError("Le ticket est vide.");
      return;
    }
    if (!storeId || !warehouseId) {
      setError("Choisissez un magasin et un dépôt.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("record_sale", {
      p_store_id: storeId,
      p_warehouse_id: warehouseId,
      p_status: status,
      p_lines: ticket.map((l) => ({
        product_id: l.product_id,
        product_unit_id: l.product_unit_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (status === "completed") {
      setLastReceipt({
        id: crypto.randomUUID(),
        organizationName,
        storeName: stores.find((s) => s.id === storeId)?.name ?? "",
        createdAt: new Date().toISOString(),
        lines: ticket.map((l) => ({
          label: l.label,
          unitLabel: l.unitLabel,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
      });
    }
    setMessage(status === "held" ? "Ticket mis en attente." : "Vente enregistrée.");
    clearTicket();
    setTimeout(() => setMessage(null), 3000);
  }

  const loadHeldSales = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("sales")
      .select("id, total, created_at")
      .eq("status", "held")
      .order("created_at", { ascending: false });
    setHeldSales((data as HeldSale[]) ?? []);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open
    if (heldOpen) void loadHeldSales();
  }, [heldOpen, loadHeldSales]);

  async function resumeHeldSale(saleId: string) {
    const { data: lines } = await supabase
      .from("sale_lines")
      .select("product_id, product_unit_id, label, quantity, unit_price, tax_rate")
      .eq("sale_id", saleId);
    if (lines) {
      setTicket(
        lines.map((l) => ({
          key: crypto.randomUUID(),
          product_id: l.product_id,
          product_unit_id: l.product_unit_id,
          label: l.label,
          unitLabel: l.product_unit_id
            ? unitLabel(productUnits.find((pu) => pu.id === l.product_unit_id)?.unit_id ?? "")
            : unitLabel(products.find((p) => p.id === l.product_id)?.base_unit_id ?? ""),
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate),
        }))
      );
    }
    await supabase.from("sales").delete().eq("id", saleId);
    setHeldOpen(false);
    searchRef.current?.focus();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        void submitTicket("held");
      } else if (e.key === "F9") {
        e.preventDefault();
        void submitTicket("completed");
      } else if (e.key === "Escape" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        clearTicket();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, storeId, warehouseId]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <AppNav />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Caisse</CardTitle>
              <CardDescription>
                F2 rechercher · F4 mettre en attente · F9 encaisser · Échap annuler
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {stores.length > 0 && (
                <Select value={storeId} onValueChange={(v) => v && setStoreId(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {warehouses.length > 0 && (
                <Select value={warehouseId} onValueChange={(v) => v && setWarehouseId(v)}>
                  <SelectTrigger className="w-40">
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
              <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
                <DialogTrigger render={<Button variant="outline" />}>Tickets en attente</DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tickets en attente</DialogTitle>
                    <DialogDescription>Cliquez pour reprendre un ticket.</DialogDescription>
                  </DialogHeader>
                  {heldSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun ticket en attente.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {heldSales.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => void resumeHeldSale(s.id)}
                          className="flex items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-muted"
                        >
                          <span>{new Date(s.created_at).toLocaleString("fr-FR")}</span>
                          <span className="font-medium">{s.total}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {stores.length === 0 || warehouses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Créez d&apos;abord un magasin et un dépôt dans la page Magasins.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Input
                    ref={searchRef}
                    placeholder="Scanner un code-barres ou rechercher un article… (F2)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                  />
                  {query && matches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {matches.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addLine(p, null)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>{p.label}</span>
                          <span className="text-muted-foreground">{p.sale_price}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {ticket.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Ticket vide.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead>Qté</TableHead>
                        <TableHead>P.U.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ticket.map((l) => (
                        <TableRow key={l.key}>
                          <TableCell>{l.label}</TableCell>
                          <TableCell>
                            {productUnitsFor(l.product_id).length > 0 ? (
                              <Select
                                value={l.product_unit_id ?? "base"}
                                onValueChange={(v) => {
                                  if (!v) return;
                                  const product = products.find((p) => p.id === l.product_id);
                                  if (!product) return;
                                  if (v === "base") {
                                    updateLine(l.key, {
                                      product_unit_id: null,
                                      unitLabel: unitLabel(product.base_unit_id),
                                      unit_price: product.sale_price,
                                    });
                                  } else {
                                    const pu = productUnits.find((u) => u.id === v);
                                    if (!pu) return;
                                    updateLine(l.key, {
                                      product_unit_id: v,
                                      unitLabel: unitLabel(pu.unit_id),
                                      unit_price: product.sale_price * pu.coefficient_to_base,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="base">
                                    {unitLabel(products.find((p) => p.id === l.product_id)?.base_unit_id ?? "")}
                                  </SelectItem>
                                  {productUnitsFor(l.product_id).map((pu) => (
                                    <SelectItem key={pu.id} value={pu.id}>
                                      {unitLabel(pu.unit_id)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              l.unitLabel
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              className="w-20"
                              value={l.quantity}
                              onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-24"
                              value={l.unit_price}
                              onChange={(e) => updateLine(l.key, { unit_price: Number(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell>{(l.quantity * l.unit_price).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeLine(l.key)}>
                              ✕
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm">
                  <div className="flex w-48 justify-between text-muted-foreground">
                    <span>Sous-total</span>
                    <span>{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex w-48 justify-between text-muted-foreground">
                    <span>TVA</span>
                    <span>{totals.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex w-48 justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{totals.total.toFixed(2)}</span>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
                {message && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <span>{message}</span>
                    {lastReceipt && (
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        Imprimer le ticket (80mm)
                      </Button>
                    )}
                  </div>
                )}
                {ticket.length > 0 && <Badge variant="outline">{ticket.length} ligne(s)</Badge>}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={clearTicket} disabled={busy}>
                    Annuler (Échap)
                  </Button>
                  <Button variant="outline" onClick={() => void submitTicket("held")} disabled={busy}>
                    Mettre en attente (F4)
                  </Button>
                  <Button onClick={() => void submitTicket("completed")} disabled={busy}>
                    Encaisser (F9)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {lastReceipt && (
        <div id="receipt-80mm" className="font-mono text-[11px] leading-tight text-black">
          <div className="p-2">
            <p className="text-center text-sm font-bold">{lastReceipt.organizationName}</p>
            <p className="text-center">{lastReceipt.storeName}</p>
            <p className="text-center">{new Date(lastReceipt.createdAt).toLocaleString("fr-FR")}</p>
            <hr className="my-1 border-dashed border-black" />
            {lastReceipt.lines.map((l, i) => (
              <div key={i} className="mb-1">
                <div>{l.label}</div>
                <div className="flex justify-between">
                  <span>
                    {l.quantity} {l.unitLabel} × {l.unit_price.toFixed(2)}
                  </span>
                  <span>{(l.quantity * l.unit_price).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <hr className="my-1 border-dashed border-black" />
            <div className="flex justify-between">
              <span>Sous-total</span>
              <span>{lastReceipt.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>TVA</span>
              <span>{lastReceipt.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span>{lastReceipt.total.toFixed(2)}</span>
            </div>
            <p className="mt-2 text-center">Merci de votre visite !</p>
          </div>
        </div>
      )}
    </div>
  );
}
