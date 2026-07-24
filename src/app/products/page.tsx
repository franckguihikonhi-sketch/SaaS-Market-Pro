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
  DialogFooter,
} from "@/components/ui/dialog";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type Category = { id: string; name: string };
type Brand = { id: string; name: string };
type Unit = { id: string; code: string; label: string };
type Warehouse = { id: string; name: string };
type Product = {
  id: string;
  code: string;
  barcode: string | null;
  label: string;
  category_id: string | null;
  brand_id: string | null;
  base_unit_id: string;
  purchase_price: number;
  sale_price: number;
  tax_rate: number;
  min_stock: number;
  status: string;
};
type ProductUnit = {
  id: string;
  product_id: string;
  unit_id: string;
  coefficient_to_base: number;
  is_base: boolean;
  barcode: string | null;
};

function ProductUnitsDialog({
  product,
  units,
  canWrite,
}: {
  product: Product;
  units: Unit[];
  canWrite: boolean;
}) {
  const [items, setItems] = useState<ProductUnit[]>([]);
  const [unitId, setUnitId] = useState<string>("");
  const [coefficient, setCoefficient] = useState("");
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_units")
      .select("id, product_id, unit_id, coefficient_to_base, is_base, barcode")
      .eq("product_id", product.id);
    setItems((data as ProductUnit[]) ?? []);
    setLoading(false);
  }, [product.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open
    if (open) void load();
  }, [open, load]);

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const coeff = Number(coefficient);
    if (!unitId || !coeff || coeff <= 0) {
      setError("Choisissez une unité et un coefficient valide (> 0).");
      return;
    }
    const { error } = await supabase.from("product_units").insert({
      product_id: product.id,
      unit_id: unitId,
      coefficient_to_base: coeff,
      barcode: barcode || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setUnitId("");
    setCoefficient("");
    setBarcode("");
    void load();
  }

  const baseUnit = units.find((u) => u.id === product.base_unit_id);
  const availableUnits = units.filter((u) => u.id !== product.base_unit_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Unités de vente
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.label}</DialogTitle>
          <DialogDescription>
            Unité de base : {baseUnit?.label ?? "—"}. Ajoutez des unités de vente
            alternatives (ex. Carton = 24 × {baseUnit?.label ?? "unité de base"}).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune unité alternative.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unité</TableHead>
                <TableHead>Coefficient</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((pu) => (
                <TableRow key={pu.id}>
                  <TableCell>{units.find((u) => u.id === pu.unit_id)?.label ?? "—"}</TableCell>
                  <TableCell>
                    1 = {pu.coefficient_to_base} × {baseUnit?.label ?? "unité de base"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {canWrite && (
          <form onSubmit={addUnit} className="flex flex-col gap-3 border-t pt-3">
            <div className="flex flex-col gap-2">
              <Label>Unité</Label>
              <Select
                items={availableUnits.map((u) => ({ value: u.id, label: u.label }))}
                value={unitId}
                onValueChange={(v) => v && setUnitId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir une unité" />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pu-coeff">
                Coefficient (1 unité = combien de {baseUnit?.label ?? "unité de base"} ?)
              </Label>
              <Input
                id="pu-coeff"
                type="number"
                min="0"
                step="0.000001"
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pu-barcode">Code-barres (optionnel)</Label>
              <Input id="pu-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit">Ajouter cette unité</Button>
          </form>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function NewProductDialog({
  organizationId,
  categories,
  brands,
  units,
  warehouses,
  onCreated,
}: {
  organizationId: string;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  warehouses: Warehouse[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [brandId, setBrandId] = useState("none");
  const [baseUnitId, setBaseUnitId] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [salePrice, setSalePrice] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [altUnits, setAltUnits] = useState<{ key: string; unitId: string; coefficient: string }[]>([]);
  const [altUnitDraftId, setAltUnitDraftId] = useState("");
  const [altUnitDraftCoeff, setAltUnitDraftCoeff] = useState("");
  const [initialWarehouseId, setInitialWarehouseId] = useState("none");
  const [initialStock, setInitialStock] = useState("0");
  const [initialStockTouched, setInitialStockTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleMinStockChange(value: string) {
    setMinStock(value);
    if (!initialStockTouched) setInitialStock(value);
  }

  function coefficientFor(unitId: string) {
    return unitId === "base" ? 1 : Number(altUnits.find((a) => a.unitId === unitId)?.coefficient) || 1;
  }

  function quantityFor(unitId: string) {
    const coeff = coefficientFor(unitId);
    return coeff === 1 ? initialStock : String(Number((Number(initialStock) / coeff).toFixed(6)));
  }

  function handleUnitQuantityChange(unitId: string, rawValue: string) {
    const baseValue = (Number(rawValue) || 0) * coefficientFor(unitId);
    setInitialStock(String(baseValue));
    setInitialStockTouched(true);
  }

  const availableAltUnits = units.filter(
    (u) => u.id !== baseUnitId && !altUnits.some((a) => a.unitId === u.id)
  );

  function addAltUnit() {
    const coeff = Number(altUnitDraftCoeff);
    if (!altUnitDraftId || !coeff || coeff <= 0) {
      setError("Choisissez une unité alternative et un coefficient valide (> 0).");
      return;
    }
    setAltUnits((cur) => [...cur, { key: crypto.randomUUID(), unitId: altUnitDraftId, coefficient: altUnitDraftCoeff }]);
    setAltUnitDraftId("");
    setAltUnitDraftCoeff("");
    setError(null);
  }

  function removeAltUnit(key: string) {
    setAltUnits((cur) => cur.filter((a) => a.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!baseUnitId) {
      setError("Choisissez une unité de base.");
      return;
    }
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        organization_id: organizationId,
        label,
        code,
        barcode: barcode || null,
        category_id: categoryId === "none" ? null : categoryId,
        brand_id: brandId === "none" ? null : brandId,
        base_unit_id: baseUnitId,
        purchase_price: Number(purchasePrice) || 0,
        sale_price: Number(salePrice) || 0,
        tax_rate: Number(taxRate) || 0,
        min_stock: Number(minStock) || 0,
      })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    if (altUnits.length > 0) {
      const { error: altError } = await supabase.from("product_units").insert(
        altUnits.map((a) => ({
          product_id: created.id,
          unit_id: a.unitId,
          coefficient_to_base: Number(a.coefficient),
        }))
      );
      if (altError) {
        setError(`Article créé, mais échec de l'ajout des unités alternatives : ${altError.message}`);
        onCreated();
        return;
      }
    }
    const stockQty = Number(initialStock) || 0;
    if (stockQty > 0 && initialWarehouseId !== "none") {
      const { error: stockError } = await supabase.rpc("record_stock_movement", {
        p_product_id: created.id,
        p_warehouse_id: initialWarehouseId,
        p_type: "inventory_count",
        p_quantity: stockQty,
        p_reason: "Stock initial",
      });
      if (stockError) {
        setError(`Article créé, mais échec de l'enregistrement du stock initial : ${stockError.message}`);
        onCreated();
        return;
      }
    }
    setLabel("");
    setCode("");
    setBarcode("");
    setCategoryId("none");
    setBrandId("none");
    setBaseUnitId("");
    setPurchasePrice("0");
    setSalePrice("0");
    setTaxRate("0");
    setMinStock("0");
    setAltUnits([]);
    setAltUnitDraftId("");
    setAltUnitDraftCoeff("");
    setInitialWarehouseId("none");
    setInitialStock("0");
    setInitialStockTouched(false);
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Nouvel article</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel article</DialogTitle>
          <DialogDescription>L&apos;unité de base est celle utilisée pour le suivi du stock.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-label">Désignation</Label>
            <Input id="p-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="p-code">Code</Label>
              <Input id="p-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="p-barcode">Code-barres</Label>
              <Input id="p-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label>Catégorie</Label>
              <Select
                items={[{ value: "none", label: "Aucune" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                value={categoryId}
                onValueChange={(v) => v && setCategoryId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label>Marque</Label>
              <Select
                items={[{ value: "none", label: "Aucune" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
                value={brandId}
                onValueChange={(v) => v && setBrandId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Unité de base</Label>
            <Select
              items={units.map((u) => ({ value: u.id, label: u.label }))}
              value={baseUnitId}
              onValueChange={(v) => v && setBaseUnitId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une unité" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {baseUnitId && (
            <div className="flex flex-col gap-2 rounded-md border p-2">
              <span className="text-sm font-medium">Unités de vente alternatives (optionnel)</span>
              <span className="text-xs text-muted-foreground">
                Ex. Carton = 36 × {units.find((u) => u.id === baseUnitId)?.label ?? "unité de base"}
              </span>
              {altUnits.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {altUnits.map((a) => (
                    <li key={a.key} className="flex items-center justify-between text-sm">
                      <span>
                        1 {units.find((u) => u.id === a.unitId)?.label ?? "?"} = {a.coefficient} ×{" "}
                        {units.find((u) => u.id === baseUnitId)?.label ?? "unité de base"}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAltUnit(a.key)}>
                        ✕
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {availableAltUnits.length > 0 && (
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <Select
                      items={availableAltUnits.map((u) => ({ value: u.id, label: u.label }))}
                      value={altUnitDraftId}
                      onValueChange={(v) => v && setAltUnitDraftId(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unité alternative" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAltUnits.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    className="w-28"
                    placeholder="Coefficient"
                    value={altUnitDraftCoeff}
                    onChange={(e) => setAltUnitDraftCoeff(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={addAltUnit}>
                    Ajouter
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="p-purchase">Prix d&apos;achat</Label>
              <Input id="p-purchase" type="number" min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="p-sale">Prix de vente</Label>
              <Input id="p-sale" type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="p-tax">TVA (%)</Label>
              <Input id="p-tax" type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="p-min">
                Stock minimum ({units.find((u) => u.id === baseUnitId)?.label ?? "unité de base"})
              </Label>
              <Input
                id="p-min"
                type="number"
                min="0"
                step="0.01"
                value={minStock}
                onChange={(e) => handleMinStockChange(e.target.value)}
              />
            </div>
          </div>

          {warehouses.length > 0 && (
            <div className="flex gap-2 rounded-md border p-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label>Stock initial — Dépôt</Label>
                <Select
                  items={[
                    { value: "none", label: "Aucun (ne pas créer de stock)" },
                    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
                  ]}
                  value={initialWarehouseId}
                  onValueChange={(v) => v && setInitialWarehouseId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun (ne pas créer de stock)</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label>Quantité</Label>
                <div className="flex flex-wrap gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      {units.find((u) => u.id === baseUnitId)?.label ?? "unité de base"}
                    </span>
                    <Input
                      id="p-initial-stock"
                      type="number"
                      min="0"
                      step="0.000001"
                      className="w-28"
                      value={quantityFor("base")}
                      onChange={(e) => handleUnitQuantityChange("base", e.target.value)}
                      disabled={initialWarehouseId === "none"}
                    />
                  </div>
                  {altUnits.map((a) => (
                    <div key={a.unitId} className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        {units.find((u) => u.id === a.unitId)?.label ?? "?"}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.000001"
                        className="w-28"
                        value={quantityFor(a.unitId)}
                        onChange={(e) => handleUnitQuantityChange(a.unitId, e.target.value)}
                        disabled={initialWarehouseId === "none"}
                      />
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Les champs se convertissent automatiquement entre eux · reprend le stock minimum par défaut,
                  modifiable.
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit">Créer l&apos;article</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUSES = [
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "archived", label: "Archivé" },
];

function EditProductDialog({
  product,
  categories,
  brands,
  units,
  onUpdated,
}: {
  product: Product;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(product.label);
  const [code, setCode] = useState(product.code);
  const [barcode, setBarcode] = useState(product.barcode ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id ?? "none");
  const [brandId, setBrandId] = useState(product.brand_id ?? "none");
  const [baseUnitId, setBaseUnitId] = useState(product.base_unit_id);
  const [baseUnitLocked, setBaseUnitLocked] = useState(true);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState(String(product.purchase_price));
  const [salePrice, setSalePrice] = useState(String(product.sale_price));
  const [taxRate, setTaxRate] = useState(String(product.tax_rate));
  const [minStock, setMinStock] = useState(String(product.min_stock));
  const [status, setStatus] = useState(product.status);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload the form each time the dialog opens
    setLabel(product.label);
    setCode(product.code);
    setBarcode(product.barcode ?? "");
    setCategoryId(product.category_id ?? "none");
    setBrandId(product.brand_id ?? "none");
    setBaseUnitId(product.base_unit_id);
    setPurchasePrice(String(product.purchase_price));
    setSalePrice(String(product.sale_price));
    setTaxRate(String(product.tax_rate));
    setMinStock(String(product.min_stock));
    setStatus(product.status);
    setError(null);
    setCheckingEligibility(true);
    Promise.all([
      supabase.from("stocks").select("id", { count: "exact", head: true }).eq("product_id", product.id).gt("quantity", 0),
      supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("product_id", product.id),
      supabase.from("sale_lines").select("id", { count: "exact", head: true }).eq("product_id", product.id),
    ]).then(([s, m, sl]) => {
      setBaseUnitLocked((s.count ?? 0) > 0 || (m.count ?? 0) > 0 || (sl.count ?? 0) > 0);
      setCheckingEligibility(false);
    });
  }, [open, product]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        label,
        code,
        barcode: barcode || null,
        category_id: categoryId === "none" ? null : categoryId,
        brand_id: brandId === "none" ? null : brandId,
        base_unit_id: baseUnitId,
        purchase_price: Number(purchasePrice) || 0,
        sale_price: Number(salePrice) || 0,
        tax_rate: Number(taxRate) || 0,
        min_stock: Number(minStock) || 0,
        status,
      })
      .eq("id", product.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOpen(false);
    onUpdated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Modifier</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;article</DialogTitle>
          <DialogDescription>
            L&apos;unité de base doit toujours être la plus petite unité (ex. Unité) — les unités plus grandes
            (Carton, Sac…) se déclarent via « Unités de vente » avec un coefficient.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="e-label">Désignation</Label>
            <Input id="e-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Unité de base</Label>
            <Select
              items={units.map((u) => ({ value: u.id, label: u.label }))}
              value={baseUnitId}
              onValueChange={(v) => v && setBaseUnitId(v)}
            >
              <SelectTrigger className="w-full" disabled={baseUnitLocked || checkingEligibility}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">
              {checkingEligibility
                ? "Vérification…"
                : baseUnitLocked
                  ? "Modifiable uniquement tant que l'article n'a ni stock, ni mouvement, ni vente enregistrée."
                  : "Changer l'unité de base ne recalcule pas les coefficients des unités de vente déjà créées — vérifiez-les après modification."}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-code">Code</Label>
              <Input id="e-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-barcode">Code-barres</Label>
              <Input id="e-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label>Catégorie</Label>
              <Select
                items={[{ value: "none", label: "Aucune" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                value={categoryId}
                onValueChange={(v) => v && setCategoryId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label>Marque</Label>
              <Select
                items={[{ value: "none", label: "Aucune" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
                value={brandId}
                onValueChange={(v) => v && setBrandId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-purchase">Prix d&apos;achat</Label>
              <Input id="e-purchase" type="number" min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-sale">Prix de vente</Label>
              <Input id="e-sale" type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-tax">TVA (%)</Label>
              <Input id="e-tax" type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-min">
                Stock minimum ({units.find((u) => u.id === product.base_unit_id)?.label ?? "unité de base"})
              </Label>
              <Input id="e-min" type="number" min="0" step="0.01" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Statut</Label>
            <Select items={STATUSES} value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductButton({ product, onDeleted }: { product: Product; onDeleted: () => void }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement « ${product.label} » ?`)) return;
    setChecking(true);
    setError(null);
    const [{ count: stockCount }, { count: movementCount }, { count: saleCount }] = await Promise.all([
      supabase
        .from("stocks")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .gt("quantity", 0),
      supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("product_id", product.id),
      supabase.from("sale_lines").select("id", { count: "exact", head: true }).eq("product_id", product.id),
    ]);
    if ((stockCount ?? 0) > 0 || (movementCount ?? 0) > 0 || (saleCount ?? 0) > 0) {
      setChecking(false);
      setError(
        `Impossible de supprimer « ${product.label} » : il a du stock, un historique de mouvements, ou a déjà été vendu.`
      );
      return;
    }
    const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
    setChecking(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onDeleted();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={() => void handleDelete()} disabled={checking}>
        {checking ? "Vérification…" : "Supprimer"}
      </Button>
      {error && <p className="max-w-48 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) router.push("/login");
    // Articles réservés au super_admin, admin, gérant et gestionnaire de stock.
    else if (profile && !["super_admin", "admin", "manager", "warehouse_keeper"].includes(profile.role))
      router.push(profile.role === "cashier" ? "/pos" : "/dashboard");
  }, [loading, session, profile, router]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoadingData(true);
    const [{ data: p }, { data: c }, { data: b }, { data: u }, { data: w }] = await Promise.all([
      supabase
        .from("products")
        .select("id, code, barcode, label, category_id, brand_id, base_unit_id, purchase_price, sale_price, tax_rate, min_stock, status")
        .eq("organization_id", profile.organization_id)
        .order("label"),
      supabase.from("categories").select("id, name").eq("organization_id", profile.organization_id).order("name"),
      supabase.from("brands").select("id, name").eq("organization_id", profile.organization_id).order("name"),
      supabase.from("units").select("id, code, label").eq("organization_id", profile.organization_id).order("code"),
      supabase.from("warehouses").select("id, name").eq("organization_id", profile.organization_id).order("name"),
    ]);
    setProducts((p as Product[]) ?? []);
    setCategories((c as Category[]) ?? []);
    setBrands((b as Brand[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setWarehouses((w as Warehouse[]) ?? []);
    setLoadingData(false);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-8">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const canWrite = ["super_admin", "admin", "manager", "warehouse_keeper"].includes(profile.role);
  const hasUnits = units.length > 0;

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <AppNav />
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Articles</CardTitle>
              <CardDescription>Catalogue de votre organisation</CardDescription>
            </div>
            {canWrite &&
              (hasUnits ? (
                <NewProductDialog
                  organizationId={profile.organization_id}
                  categories={categories}
                  brands={brands}
                  units={units}
                  warehouses={warehouses}
                  onCreated={load}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Créez d&apos;abord une unité dans le Catalogue.
                </p>
              ))}
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun article.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Unité de base</TableHead>
                    <TableHead>Prix de vente</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.label}</TableCell>
                      <TableCell className="text-muted-foreground">{p.code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {units.find((u) => u.id === p.base_unit_id)?.label ?? "—"}
                      </TableCell>
                      <TableCell>{p.sale_price}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "secondary" : "outline"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <ProductUnitsDialog product={p} units={units} canWrite={canWrite} />
                          {canWrite && (
                            <EditProductDialog
                              product={p}
                              categories={categories}
                              brands={brands}
                              units={units}
                              onUpdated={load}
                            />
                          )}
                          {canWrite && <DeleteProductButton product={p} onDeleted={load} />}
                        </div>
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
