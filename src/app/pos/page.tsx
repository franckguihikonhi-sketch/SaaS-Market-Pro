"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type Store = { id: string; name: string };
type Warehouse = { id: string; name: string; store_id: string | null };
type Unit = { id: string; code: string; label: string };
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
  code: string;
  label: string;
  unitLabel: string;
  unitCode: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
};

type HeldSale = { id: string; total: number; created_at: string };
type Customer = { id: string; name: string };
type PaymentMethod = "cash" | "card" | "mobile_money" | "credit" | "check";
type PaymentLine = { key: string; method: PaymentMethod; amount: number; auto: boolean };

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "credit", label: "Crédit client" },
  { value: "check", label: "Chèque" },
];

type Receipt = {
  id: string;
  organizationName: string;
  storeName: string;
  customerName: string;
  createdAt: string;
  lines: { label: string; unitLabel: string; quantity: number; unit_price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  payments: PaymentLine[];
};

function lineAmount(l: TicketLine) {
  return l.quantity * l.unit_price * (1 - l.discount / 100);
}

function printWithTarget(target: "80mm" | "a4") {
  document.documentElement.setAttribute("data-print-target", target);
  const style = document.createElement("style");
  style.textContent =
    target === "80mm" ? "@page { size: 80mm auto; margin: 0; }" : "@page { size: A4; margin: 15mm; }";
  document.head.appendChild(style);
  const cleanup = () => {
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

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
  const [browseOpen, setBrowseOpen] = useState(false);
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingDiscount, setPendingDiscount] = useState("0");
  const [pendingUnitId, setPendingUnitId] = useState("base");
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("none");
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [cashReceived, setCashReceived] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  const loadBase = useCallback(async () => {
    if (!profile) return;
    const [{ data: org }, { data: s }, { data: w }, { data: u }, { data: p }, { data: pu }, { data: c }] =
      await Promise.all([
        supabase.from("organizations").select("name").eq("id", profile.organization_id).single(),
        supabase.from("stores").select("id, name").eq("organization_id", profile.organization_id).order("name"),
        supabase.from("warehouses").select("id, name, store_id").eq("organization_id", profile.organization_id).order("name"),
        supabase.from("units").select("id, code, label").eq("organization_id", profile.organization_id),
        supabase
          .from("products")
          .select("id, code, barcode, label, base_unit_id, sale_price, tax_rate, status")
          .eq("organization_id", profile.organization_id)
          .eq("status", "active")
          .order("label"),
        supabase.from("product_units").select("id, product_id, unit_id, coefficient_to_base, barcode"),
        supabase.from("customers").select("id, name").eq("organization_id", profile.organization_id).order("name"),
      ]);
    setOrganizationName(org?.name ?? "");
    setStores((s as Store[]) ?? []);
    setWarehouses((w as Warehouse[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setProductUnits((pu as ProductUnit[]) ?? []);
    setCustomers((c as Customer[]) ?? []);
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
  const unitCode = useCallback(
    (id: string) => {
      const u = units.find((u) => u.id === id);
      return u?.code || u?.label || "—";
    },
    [units]
  );

  const productUnitsFor = useCallback(
    (productId: string) => productUnits.filter((pu) => pu.product_id === productId),
    [productUnits]
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

  const dropdownItems = query ? matches : browseOpen ? products : [];
  const dropdownVisible = !editingKey && (query ? matches.length > 1 : browseOpen && products.length > 0);

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

  const selectedLine = editingKey ? ticket.find((l) => l.key === editingKey) ?? null : null;
  const matchedProduct = editingKey ? null : exactMatch?.product ?? (matches.length === 1 ? matches[0] : null);
  const entryProduct = editingKey
    ? selectedLine
      ? products.find((p) => p.id === selectedLine.product_id) ?? null
      : null
    : matchedProduct;
  const suggestedPrice = useMemo(() => {
    if (!entryProduct) return 0;
    const coeff =
      pendingUnitId === "base"
        ? 1
        : productUnits.find((pu) => pu.id === pendingUnitId)?.coefficient_to_base ?? 1;
    return entryProduct.sale_price * coeff;
  }, [entryProduct, pendingUnitId, productUnits]);
  const displayedUnitPrice = priceOverride ?? (entryProduct ? suggestedPrice.toFixed(2) : "");

  function resetEntry() {
    setQuery("");
    setBrowseOpen(false);
    setPendingQty("1");
    setPendingDiscount("0");
    setPendingUnitId("base");
    setPriceOverride(null);
    setEditingKey(null);
    setError(null);
    searchRef.current?.focus();
  }

  function addOrUpdateLine(
    product: Product,
    productUnitId: string | null,
    quantity: number,
    discount: number,
    unitPrice: number
  ) {
    const unitLbl = productUnitId
      ? unitLabel(productUnits.find((pu) => pu.id === productUnitId)?.unit_id ?? "")
      : unitLabel(product.base_unit_id);
    const unitCd = productUnitId
      ? unitCode(productUnits.find((pu) => pu.id === productUnitId)?.unit_id ?? "")
      : unitCode(product.base_unit_id);
    setTicket((cur) => {
      const existing = cur.find((l) => l.product_id === product.id && l.product_unit_id === productUnitId);
      if (existing) {
        return cur.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + quantity, discount, unit_price: unitPrice } : l
        );
      }
      return [
        ...cur,
        {
          key: crypto.randomUUID(),
          product_id: product.id,
          product_unit_id: productUnitId,
          code: product.code,
          label: product.label,
          unitLabel: unitLbl,
          unitCode: unitCd,
          quantity,
          unit_price: unitPrice,
          discount,
          tax_rate: product.tax_rate,
        },
      ];
    });
    resetEntry();
  }

  function confirmEntry() {
    const qty = Number(pendingQty) || 0;
    const discount = Number(pendingDiscount) || 0;
    if (qty <= 0) {
      setError("Quantité invalide.");
      return;
    }
    if (editingKey) {
      const line = ticket.find((l) => l.key === editingKey);
      const product = line ? products.find((p) => p.id === line.product_id) : undefined;
      if (!line || !product) {
        resetEntry();
        return;
      }
      const productUnitId = pendingUnitId === "base" ? null : pendingUnitId;
      const unitLbl = productUnitId
        ? unitLabel(productUnits.find((pu) => pu.id === productUnitId)?.unit_id ?? "")
        : unitLabel(product.base_unit_id);
      const unitCd = productUnitId
        ? unitCode(productUnits.find((pu) => pu.id === productUnitId)?.unit_id ?? "")
        : unitCode(product.base_unit_id);
      updateLine(editingKey, {
        quantity: qty,
        discount,
        product_unit_id: productUnitId,
        unit_price: Number(priceOverride) || suggestedPrice,
        unitLabel: unitLbl,
        unitCode: unitCd,
      });
      resetEntry();
      return;
    }
    if (matchedProduct) {
      const productUnitId = exactMatch?.productUnitId ?? (pendingUnitId === "base" ? null : pendingUnitId);
      addOrUpdateLine(matchedProduct, productUnitId, qty, discount, Number(priceOverride) || suggestedPrice);
    } else {
      setError("Article introuvable.");
    }
  }

  function handleReferenceChange(value: string) {
    if (editingKey) setEditingKey(null);
    setPendingUnitId("base");
    setPriceOverride(null);
    setQuery(value);
  }

  function handleReferenceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmEntry();
    } else if (e.key === "Escape" && browseOpen) {
      e.preventDefault();
      setBrowseOpen(false);
    }
  }

  function updateLine(key: string, patch: Partial<TicketLine>) {
    setTicket((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectLine(l: TicketLine) {
    setEditingKey(l.key);
    setQuery("");
    setPendingQty(String(l.quantity));
    setPendingDiscount(String(l.discount));
    setPendingUnitId(l.product_unit_id ?? "base");
    setPriceOverride(String(l.unit_price));
    setError(null);
  }

  function deleteSelected() {
    if (!editingKey) return;
    setTicket((cur) => cur.filter((l) => l.key !== editingKey));
    resetEntry();
  }

  function clearTicket() {
    setTicket([]);
    setPayments([]);
    setCashReceived("");
    resetEntry();
    setMessage(null);
  }

  const totals = useMemo(() => {
    const subtotal = ticket.reduce((sum, l) => sum + lineAmount(l), 0);
    const tax = ticket.reduce((sum, l) => sum + (lineAmount(l) * l.tax_rate) / 100, 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [ticket]);

  const effectiveAmount = useCallback(
    (p: PaymentLine) => (p.auto ? Number(totals.total.toFixed(2)) : p.amount),
    [totals.total]
  );
  const displayedPayments: PaymentLine[] = useMemo(
    () =>
      payments.length > 0
        ? payments
        : ticket.length > 0
          ? [{ key: "auto", method: "cash" as PaymentMethod, amount: Number(totals.total.toFixed(2)), auto: true }]
          : [],
    [payments, ticket.length, totals.total]
  );
  const paidTotal = useMemo(
    () => displayedPayments.reduce((sum, p) => sum + effectiveAmount(p), 0),
    [displayedPayments, effectiveAmount]
  );
  const paymentBalanced = ticket.length > 0 && Math.abs(paidTotal - totals.total) < 0.01;
  const changeDue = Math.max(0, Number(cashReceived || 0) - totals.total);

  async function submitTicket(status: "held" | "completed") {
    if (ticket.length === 0) {
      setError("Le ticket est vide.");
      return;
    }
    if (!storeId || !warehouseId) {
      setError("Choisissez un magasin et un dépôt.");
      return;
    }
    const finalPayments = status === "completed" ? displayedPayments : [];
    if (status === "completed" && !paymentBalanced) {
      setError("Le montant réglé ne correspond pas au total.");
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
        unit_price: l.unit_price * (1 - l.discount / 100),
      })),
      p_customer_id: customerId === "none" ? null : customerId,
      p_payments:
        status === "completed"
          ? finalPayments.map((p) => ({ method: p.method, amount: effectiveAmount(p) }))
          : null,
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
        customerName: customerId === "none" ? "" : customers.find((c) => c.id === customerId)?.name ?? "",
        createdAt: new Date().toISOString(),
        lines: ticket.map((l) => ({
          label: l.label,
          unitLabel: l.unitLabel,
          quantity: l.quantity,
          unit_price: l.unit_price * (1 - l.discount / 100),
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        payments: finalPayments.map((p) => ({ ...p, amount: effectiveAmount(p) })),
      });
    }
    setMessage(status === "held" ? "Ticket mis en attente." : "Vente enregistrée.");
    setTicket([]);
    setPayments([]);
    setCashReceived("");
    resetEntry();
    setCustomerId("none");
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
    const [{ data: lines }, { data: sale }] = await Promise.all([
      supabase
        .from("sale_lines")
        .select("product_id, product_unit_id, label, quantity, unit_price, tax_rate")
        .eq("sale_id", saleId),
      supabase.from("sales").select("customer_id").eq("id", saleId).single(),
    ]);
    setCustomerId(sale?.customer_id ?? "none");
    if (lines) {
      setTicket(
        lines.map((l) => ({
          key: crypto.randomUUID(),
          product_id: l.product_id,
          product_unit_id: l.product_unit_id,
          code: products.find((p) => p.id === l.product_id)?.code ?? "",
          label: l.label,
          unitLabel: l.product_unit_id
            ? unitLabel(productUnits.find((pu) => pu.id === l.product_unit_id)?.unit_id ?? "")
            : unitLabel(products.find((p) => p.id === l.product_id)?.base_unit_id ?? ""),
          unitCode: l.product_unit_id
            ? unitCode(productUnits.find((pu) => pu.id === l.product_unit_id)?.unit_id ?? "")
            : unitCode(products.find((p) => p.id === l.product_id)?.base_unit_id ?? ""),
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          discount: 0,
          tax_rate: Number(l.tax_rate),
        }))
      );
    }
    await supabase.from("sales").delete().eq("id", saleId);
    setHeldOpen(false);
    resetEntry();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        setBrowseOpen((v) => !v);
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
  }, [ticket, storeId, warehouseId, displayedPayments, paymentBalanced]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const noSetup = stores.length === 0 || warehouses.length === 0;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <AppNav />

        {noSetup ? (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Créez d&apos;abord un magasin et un dépôt dans la page Magasins.
          </div>
        ) : (
          <div
            className={cn(
              "overflow-hidden rounded-md border border-slate-400 bg-slate-100 shadow-lg",
              maximized && "fixed inset-4 z-50 flex flex-col"
            )}
          >
            {/* Barre de titre */}
            <div className="flex items-center justify-between bg-gradient-to-b from-slate-600 to-slate-700 px-3 py-1.5 text-white">
              <span className="text-sm font-medium">
                Ticket de caisse — {stores.find((s) => s.id === storeId)?.name ?? "Magasin"}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Réduire"
                  onClick={() => setMinimized((v) => !v)}
                  className="flex h-4 w-4 items-center justify-center rounded-sm bg-white/20 text-[10px] hover:bg-white/30"
                >
                  _
                </button>
                <button
                  type="button"
                  aria-label={maximized ? "Restaurer" : "Agrandir"}
                  onClick={() => setMaximized((v) => !v)}
                  className="flex h-4 w-4 items-center justify-center rounded-sm bg-white/20 text-[10px] hover:bg-white/30"
                >
                  {maximized ? "❐" : "□"}
                </button>
              </div>
            </div>

            <div
              className={cn(
                "flex flex-col gap-3 p-3",
                minimized && "hidden",
                maximized && "flex-1 overflow-y-auto"
              )}
            >
              {/* En-tête : caissier / date / total */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    Caissier <strong>{profile.full_name}</strong>
                  </span>
                  <span>Date {new Date().toLocaleDateString("fr-FR")}</span>
                  {stores.length > 1 && (
                    <Select
                      items={stores.map((s) => ({ value: s.id, label: s.name }))}
                      value={storeId}
                      onValueChange={(v) => v && setStoreId(v)}
                    >
                      <SelectTrigger className="h-7 w-36" size="sm">
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
                  {warehouses.length > 1 && (
                    <Select
                      items={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                      value={warehouseId}
                      onValueChange={(v) => v && setWarehouseId(v)}
                    >
                      <SelectTrigger className="h-7 w-36" size="sm">
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
                </div>
                <div className="flex items-center gap-3 rounded-md bg-emerald-200 px-4 py-1.5">
                  <span className="text-sm font-semibold text-emerald-900">Total TTC</span>
                  <span className="text-2xl font-bold text-emerald-900">{totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Ligne de saisie */}
              <div className="flex flex-wrap items-end gap-2 rounded-md border bg-white p-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Référence</span>
                  <Input
                    ref={searchRef}
                    className="h-8 w-32"
                    value={editingKey ? selectedLine?.code ?? "" : query}
                    onChange={(e) => handleReferenceChange(e.target.value)}
                    onKeyDown={handleReferenceKeyDown}
                    placeholder="Code / scan (F2)"
                    readOnly={!!editingKey}
                  />
                </div>
                <div className="relative flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Désignation</span>
                  <Input
                    className="h-8"
                    readOnly
                    value={editingKey ? selectedLine?.label ?? "" : matchedProduct?.label ?? ""}
                    placeholder={query && !matchedProduct ? "Aucun article correspondant" : ""}
                  />
                  {dropdownVisible && (
                    <div className="absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                      {dropdownItems.map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            addOrUpdateLine(p, null, Number(pendingQty) || 1, Number(pendingDiscount) || 0, p.sale_price)
                          }
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>
                            {p.label} <span className="text-xs text-muted-foreground">({p.code})</span>
                          </span>
                          <span className="text-muted-foreground">{p.sale_price}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {entryProduct && productUnitsFor(entryProduct.id).length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Unité</span>
                    <Select
                      items={[
                        { value: "base", label: unitCode(entryProduct.base_unit_id) },
                        ...productUnitsFor(entryProduct.id).map((pu) => ({
                          value: pu.id,
                          label: unitCode(pu.unit_id),
                        })),
                      ]}
                      value={pendingUnitId}
                      onValueChange={(v) => {
                        if (!v) return;
                        setPendingUnitId(v);
                        setPriceOverride(null);
                      }}
                    >
                      <SelectTrigger className="h-8 w-20" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">{unitCode(entryProduct.base_unit_id)}</SelectItem>
                        {productUnitsFor(entryProduct.id).map((pu) => (
                          <SelectItem key={pu.id} value={pu.id}>
                            {unitCode(pu.unit_id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">P.U.</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8 w-24"
                    value={displayedUnitPrice}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    disabled={!entryProduct}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Quantité</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    className="h-8 w-20"
                    value={pendingQty}
                    onChange={(e) => setPendingQty(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Remise %</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="h-8 w-20"
                    value={pendingDiscount}
                    onChange={(e) => setPendingDiscount(e.target.value)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={resetEntry}>
                    Nouveau
                  </Button>
                  <Button variant="outline" size="sm" onClick={deleteSelected} disabled={!editingKey}>
                    Supprimer
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmEntry}>
                    Enregistrer
                  </Button>
                </div>
              </div>

              {/* Grille du ticket */}
              <div className="max-h-64 overflow-auto rounded-md border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-200 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5">Référence</th>
                      <th className="px-2 py-1.5">Désignation</th>
                      <th className="px-2 py-1.5">Unité</th>
                      <th className="px-2 py-1.5 text-right">P.U. TTC</th>
                      <th className="px-2 py-1.5 text-right">Quantité</th>
                      <th className="px-2 py-1.5 text-right">Remise</th>
                      <th className="px-2 py-1.5 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                          Ticket vide.
                        </td>
                      </tr>
                    ) : (
                      ticket.map((l) => (
                        <tr
                          key={l.key}
                          onClick={() => selectLine(l)}
                          className={cn(
                            "cursor-pointer border-t hover:bg-muted",
                            editingKey === l.key && "bg-emerald-50"
                          )}
                        >
                          <td className="px-2 py-1">{l.code}</td>
                          <td className="px-2 py-1">{l.label}</td>
                          <td className="px-2 py-1">{l.unitCode}</td>
                          <td className="px-2 py-1 text-right">{l.unit_price.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right">{l.quantity}</td>
                          <td className="px-2 py-1 text-right">{l.discount ? `${l.discount}%` : "—"}</td>
                          <td className="px-2 py-1 text-right">{lineAmount(l).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Réglements + à rendre */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-white p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Mode de règlement</span>
                    <span className="text-xs text-muted-foreground">
                      Réglé {paidTotal.toFixed(2)} / {totals.total.toFixed(2)}
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-1">Mode</th>
                        <th className="py-1 text-right">Montant</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPayments.map((p) => (
                        <tr key={p.key} className="border-t">
                          <td className="py-1">
                            <Select
                              items={PAYMENT_METHODS}
                              value={p.method}
                              onValueChange={(v) => {
                                if (!v) return;
                                setPayments(
                                  displayedPayments.map((x) =>
                                    x.key === p.key ? { ...x, method: v as PaymentMethod } : x
                                  )
                                );
                              }}
                            >
                              <SelectTrigger className="h-7 w-full" size="sm">
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
                          </td>
                          <td className="py-1 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-7 w-24 text-right"
                              value={effectiveAmount(p)}
                              onChange={(e) =>
                                setPayments(
                                  displayedPayments.map((x) =>
                                    x.key === p.key
                                      ? { ...x, amount: Number(e.target.value) || 0, auto: false }
                                      : x
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="py-1 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPayments(displayedPayments.filter((x) => x.key !== p.key))}
                            >
                              ✕
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      setPayments([
                        ...displayedPayments,
                        {
                          key: crypto.randomUUID(),
                          method: "cash",
                          amount: Math.max(0, totals.total - paidTotal),
                          auto: false,
                        },
                      ])
                    }
                  >
                    + Mode de règlement
                  </Button>
                  {displayedPayments.some((p) => p.method === "credit") && customerId === "none" && (
                    <p className="mt-1 text-xs text-destructive">Choisissez un client pour le crédit.</p>
                  )}
                  <div className="mt-2">
                    <span className="text-[11px] text-muted-foreground">Client (optionnel)</span>
                    <Select
                      items={[
                        { value: "none", label: "Client de passage" },
                        ...customers.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                      value={customerId}
                      onValueChange={(v) => v && setCustomerId(v)}
                    >
                      <SelectTrigger className="h-7 w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Client de passage</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-md border bg-white p-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-600">Espèces reçues</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 h-8"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-white">
                    <span className="text-lg font-semibold">A rendre</span>
                    <span className="text-2xl font-bold">{changeDue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-700">
                  <span>{message}</span>
                  {lastReceipt && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => printWithTarget("80mm")}>
                        Ticket 80mm
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => printWithTarget("a4")}>
                        Facture A4
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Barre de boutons */}
              <div className="grid grid-cols-4 gap-1.5">
                <Button variant="outline" size="sm" onClick={clearTicket} disabled={busy}>
                  Annuler
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lastReceipt && printWithTarget("a4")}
                  disabled={!lastReceipt}
                >
                  Facture
                </Button>
                <Button variant="outline" size="sm" onClick={confirmEntry}>
                  Fin de saisie
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lastReceipt && printWithTarget("80mm")}
                  disabled={!lastReceipt}
                >
                  Ticket
                </Button>

                <Button variant="outline" size="sm" onClick={() => setShortcutsOpen((v) => !v)}>
                  Raccourcis
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void submitTicket("completed")}
                  disabled={busy || ticket.length === 0}
                >
                  Valider (F9)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void submitTicket("held")}
                  disabled={busy || ticket.length === 0}
                >
                  En attente
                </Button>
                <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
                  <DialogTrigger render={<Button variant="outline" size="sm" />}>Rappel ticket</DialogTrigger>
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

              {shortcutsOpen && (
                <p className="rounded-md bg-slate-200 px-3 py-2 text-xs text-slate-700">
                  F2 rechercher un article · F4 mettre en attente · F9 valider le paiement · Échap annuler le
                  ticket · Entrée dans « Référence » ajoute la ligne · Clic sur une ligne pour la modifier ou la
                  supprimer.
                </p>
              )}
            </div>
          </div>
        )}
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

      {lastReceipt && (
        <div id="invoice-a4" className="p-8 text-sm text-black">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="text-xl font-bold">{lastReceipt.organizationName}</p>
              <p className="text-muted-foreground">{lastReceipt.storeName}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">Facture</p>
              <p>{new Date(lastReceipt.createdAt).toLocaleString("fr-FR")}</p>
              {lastReceipt.customerName && <p>Client : {lastReceipt.customerName}</p>}
            </div>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Article</th>
                <th className="py-1">Qté</th>
                <th className="py-1">Unité</th>
                <th className="py-1 text-right">P.U.</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lastReceipt.lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1">{l.label}</td>
                  <td className="py-1">{l.quantity}</td>
                  <td className="py-1">{l.unitLabel}</td>
                  <td className="py-1 text-right">{l.unit_price.toFixed(2)}</td>
                  <td className="py-1 text-right">{(l.quantity * l.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <div className="flex w-64 flex-col gap-1">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>{lastReceipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>TVA</span>
                <span>{lastReceipt.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
                <span>TOTAL</span>
                <span>{lastReceipt.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {lastReceipt.payments.length > 0 && (
            <div className="mt-6">
              <p className="font-semibold">Règlement</p>
              {lastReceipt.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}</span>
                  <span>{p.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-8 text-center text-muted-foreground">Merci de votre confiance.</p>
        </div>
      )}
    </div>
  );
}
