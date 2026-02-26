"use client";

import { useState, useMemo, useCallback } from "react";
import { useSales, useCreateSale } from "@/lib/hooks/use-sales";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useDeliveriesBySale } from "@/lib/hooks/use-deliveries";
import { useCreateDeliveryWithTransactions } from "@/lib/hooks/use-delivery-with-transactions";
import { useDeleteDelivery } from "@/lib/hooks/use-deliveries";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import type { Sale, FreightPayer } from "@/lib/types/database.types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Check,
  Trash2,
  History,
  ChevronLeft,
  Scale,
  Truck,
  Users,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── FREIGHT PAYER OPTIONS ───────────────────────────────────────
const FREIGHT_PAYER_OPTIONS: { value: FreightPayer; label: string }[] = [
  { value: "customer", label: "Müşteri" },
  { value: "me", label: "Ben" },
  { value: "supplier", label: "Üretici" },
];

// ─── TYPES ───────────────────────────────────────────────────────
interface OrderConfig {
  customerId: string;
  supplierId: string;
  feedTypeId: string;
  customerPrice: string;
  supplierPrice: string;
  saleId: string | null;
  purchaseId: string | null;
}

// ─── PAGE COMPONENT ──────────────────────────────────────────────
export default function SalesPage() {
  const [view, setView] = useState<"active" | "history">("active");
  const [order, setOrder] = useState<OrderConfig>({
    customerId: "",
    supplierId: "",
    feedTypeId: "",
    customerPrice: "",
    supplierPrice: "",
    saleId: null,
    purchaseId: null,
  });
  const [selectedHistorySaleId, setSelectedHistorySaleId] = useState<string | null>(null);

  if (view === "history") {
    return (
      <HistoryView
        onBack={() => {
          setView("active");
          setSelectedHistorySaleId(null);
        }}
        selectedSaleId={selectedHistorySaleId}
        onSelectSale={setSelectedHistorySaleId}
        onLoadOrder={(sale) => {
          setOrder({
            customerId: sale.contact_id,
            supplierId: "",
            feedTypeId: sale.feed_type_id,
            customerPrice: String(sale.unit_price),
            supplierPrice: "",
            saleId: sale.id,
            purchaseId: null,
          });
          setView("active");
        }}
      />
    );
  }

  return (
    <ActiveOrderView
      order={order}
      setOrder={setOrder}
      onShowHistory={() => setView("history")}
    />
  );
}

// ─── ACTIVE ORDER VIEW ───────────────────────────────────────────
function ActiveOrderView({
  order,
  setOrder,
  onShowHistory,
}: {
  order: OrderConfig;
  setOrder: React.Dispatch<React.SetStateAction<OrderConfig>>;
  onShowHistory: () => void;
}) {
  const { data: customers } = useContacts("customer");
  const { data: suppliers } = useContacts("supplier");
  const { data: feedTypes } = useFeedTypes(true);
  const { data: allSales } = useSales();

  const createSale = useCreateSale();

  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");

  // Try to find existing sale matching the config
  const matchingSale = useMemo(() => {
    if (!allSales || !order.customerId || !order.feedTypeId) return null;
    return allSales.find(
      (s) =>
        s.contact_id === order.customerId &&
        s.feed_type_id === order.feedTypeId &&
        s.status !== "cancelled" &&
        s.status !== "delivered"
    ) || null;
  }, [allSales, order.customerId, order.feedTypeId]);

  const activeSaleId = order.saleId || matchingSale?.id || null;

  // Auto-fill price from existing sale
  const effectiveCustomerPrice = order.customerPrice || (matchingSale ? String(matchingSale.unit_price) : "");

  const isOrderReady =
    order.customerId &&
    order.supplierId &&
    order.feedTypeId &&
    effectiveCustomerPrice &&
    order.supplierPrice;

  // Create sale if needed when starting to add tickets
  const ensureSaleExists = useCallback(async (): Promise<string | null> => {
    if (activeSaleId) return activeSaleId;
    if (!order.customerId || !order.feedTypeId || !effectiveCustomerPrice) return null;

    try {
      const result = await createSale.mutateAsync({
        contact_id: order.customerId,
        feed_type_id: order.feedTypeId,
        quantity: 0,
        unit_price: parseFloat(effectiveCustomerPrice),
        sale_date: new Date().toISOString().split("T")[0],
        status: "confirmed",
      });
      setOrder((prev) => ({ ...prev, saleId: result.id }));
      return result.id;
    } catch {
      toast.error("Satış kaydı oluşturulamadı");
      return null;
    }
  }, [activeSaleId, order.customerId, order.feedTypeId, effectiveCustomerPrice, createSale, setOrder]);

  const customerName = customers?.find((c) => c.id === order.customerId)?.name;
  const supplierName = suppliers?.find((c) => c.id === order.supplierId)?.name;
  const feedTypeName = feedTypes?.find((f) => f.id === order.feedTypeId)?.name;

  return (
    <div className="flex flex-col pb-4">
      {/* ─── HEADER ─── */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="flex items-center justify-between p-4 pb-2">
          <div>
            <h1 className="text-xl font-bold">Hızlı Sevkiyat</h1>
            <p className="text-xs text-muted-foreground">Kantar fişi gir, cari otomatik işlensin</p>
          </div>
          <div className="flex items-center gap-2">
            <BalanceToggle />
            <Button variant="outline" size="sm" onClick={onShowHistory}>
              <History className="mr-1 h-4 w-4" />
              Geçmiş
            </Button>
          </div>
        </div>

        {/* ─── ORDER CONFIG (collapsible when ready) ─── */}
        <div className="px-4 pb-3 space-y-3">
          {/* Row 1: Customer + Supplier */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Müşteri</Label>
              <Select
                value={order.customerId}
                onValueChange={(v) => setOrder((p) => ({ ...p, customerId: v, saleId: null }))}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Müşteri seç" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Üretici</Label>
              <Select
                value={order.supplierId}
                onValueChange={(v) => setOrder((p) => ({ ...p, supplierId: v }))}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Üretici seç" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Feed type + Prices */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Yem Türü</Label>
              <Select
                value={order.feedTypeId}
                onValueChange={(v) => setOrder((p) => ({ ...p, feedTypeId: v, saleId: null }))}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  {feedTypes?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Müşteri ₺/kg</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={effectiveCustomerPrice}
                onChange={(e) => setOrder((p) => ({ ...p, customerPrice: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Üretici ₺/kg</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={order.supplierPrice}
                onChange={(e) => setOrder((p) => ({ ...p, supplierPrice: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Active order badge */}
          {isOrderReady && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Users className="mr-1 h-3 w-3" />
                {customerName}
              </Badge>
              <span className="text-muted-foreground">←</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {feedTypeName}
              </Badge>
              <span className="text-muted-foreground">←</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {supplierName}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 p-4 space-y-4">
        {!isOrderReady ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Scale className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Yukarıdan müşteri, üretici, yem türü ve fiyatları seçin.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ardından kantar fişlerini hızlıca girmeye başlayın.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Quick Entry Form */}
            <QuickEntryForm
              saleId={activeSaleId}
              purchaseId={order.purchaseId}
              customerContactId={order.customerId}
              supplierContactId={order.supplierId}
              customerPrice={parseFloat(effectiveCustomerPrice)}
              supplierPrice={parseFloat(order.supplierPrice)}
              ensureSaleExists={ensureSaleExists}
            />

            {/* Ticket List + Summary */}
            {activeSaleId && (
              <TicketListAndSummary
                saleId={activeSaleId}
                customerPrice={parseFloat(effectiveCustomerPrice)}
                supplierPrice={parseFloat(order.supplierPrice)}
                masked={masked}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── QUICK ENTRY FORM ────────────────────────────────────────────
function QuickEntryForm({
  saleId,
  purchaseId,
  customerContactId,
  supplierContactId,
  customerPrice,
  supplierPrice,
  ensureSaleExists,
}: {
  saleId: string | null;
  purchaseId: string | null;
  customerContactId: string;
  supplierContactId: string;
  customerPrice: number;
  supplierPrice: number;
  ensureSaleExists: () => Promise<string | null>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [ticketNo, setTicketNo] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [freightPayer, setFreightPayer] = useState<FreightPayer>("me");
  const [saving, setSaving] = useState(false);

  const createDeliveryTx = useCreateDeliveryWithTransactions();

  const resetForm = () => {
    setTicketNo("");
    setNetWeight("");
    setVehiclePlate("");
    setFreightCost("");
    // Keep date, freight payer — usually same across entries
  };

  const handleSave = async () => {
    const kg = parseFloat(netWeight);
    if (!kg || kg <= 0) {
      toast.error("Net ağırlık giriniz");
      return;
    }

    setSaving(true);
    try {
      const resolvedSaleId = await ensureSaleExists();
      if (!resolvedSaleId) return;

      await createDeliveryTx.mutateAsync({
        delivery: {
          sale_id: resolvedSaleId,
          purchase_id: purchaseId,
          delivery_date: date,
          ticket_no: ticketNo || null,
          net_weight: kg,
          vehicle_plate: vehiclePlate || null,
          freight_cost: freightCost ? parseFloat(freightCost) : null,
          freight_payer: freightCost ? freightPayer : null,
        },
        customerContactId,
        supplierContactId,
        customerPrice,
        supplierPrice,
      });

      toast.success(`${kg.toLocaleString("tr-TR")} kg kaydedildi`);
      resetForm();
      // Focus net weight for next entry
      setTimeout(() => {
        document.getElementById("net-weight-input")?.focus();
      }, 100);
    } catch (err) {
      toast.error("Kayıt hatası: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-2 border-green-200 bg-green-50/30">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Scale className="h-4 w-4" />
          Kantar Fişi Gir
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3">
        {/* Row 1: Date + Ticket No */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Tarih</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Fiş No</Label>
            <Input
              placeholder="Opsiyonel"
              value={ticketNo}
              onChange={(e) => setTicketNo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Row 2: NET WEIGHT — the hero field */}
        <div>
          <Label className="text-xs text-muted-foreground">Net Ağırlık (kg)</Label>
          <Input
            id="net-weight-input"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={netWeight}
            onChange={(e) => setNetWeight(e.target.value)}
            className="h-14 text-2xl font-bold text-center"
            autoFocus
          />
        </div>

        {/* Row 3: Plate + Freight */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Araç Plakası</Label>
            <Input
              placeholder="34 XX 1234"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              className="h-9 text-sm font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nakliye (₺)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={freightCost}
              onChange={(e) => setFreightCost(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Row 4: Freight Payer toggle */}
        {freightCost && parseFloat(freightCost) > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Nakliye Ödeyen</Label>
            <div className="mt-1 flex gap-1">
              {FREIGHT_PAYER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFreightPayer(opt.value)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    freightPayer === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview + Save */}
        {netWeight && parseFloat(netWeight) > 0 && (
          <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Müşteri alacak:</span>
              <span className="font-medium">
                {formatCurrency(
                  parseFloat(netWeight) * customerPrice -
                    (freightPayer === "customer" && freightCost ? parseFloat(freightCost) : 0)
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Üretici borç:</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(netWeight) * supplierPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kar:</span>
              <span className="font-bold text-green-700">
                {formatCurrency(
                  parseFloat(netWeight) * (customerPrice - supplierPrice) -
                    (freightPayer === "me" && freightCost ? parseFloat(freightCost) : 0)
                )}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !netWeight || parseFloat(netWeight) <= 0}
          className="w-full h-12 text-base font-bold"
          size="lg"
        >
          {saving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Check className="mr-2 h-5 w-5" />
          )}
          Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── TICKET LIST + SUMMARY ───────────────────────────────────────
function TicketListAndSummary({
  saleId,
  customerPrice,
  supplierPrice,
  masked,
}: {
  saleId: string;
  customerPrice: number;
  supplierPrice: number;
  masked: (amount: number) => string;
}) {
  const { data: deliveries, isLoading } = useDeliveriesBySale(saleId);
  const deleteDelivery = useDeleteDelivery();

  const summary = useMemo(() => {
    if (!deliveries) return { totalKg: 0, customerTotal: 0, supplierTotal: 0, freightTotal: 0, profit: 0 };
    return deliveries.reduce(
      (acc, d) => {
        const freight = d.freight_cost || 0;
        const custAmount =
          d.freight_payer === "customer"
            ? d.net_weight * customerPrice - freight
            : d.net_weight * customerPrice;
        const suppAmount = d.net_weight * supplierPrice;
        const myFreight = d.freight_payer === "me" ? freight : 0;

        return {
          totalKg: acc.totalKg + d.net_weight,
          customerTotal: acc.customerTotal + custAmount,
          supplierTotal: acc.supplierTotal + suppAmount,
          freightTotal: acc.freightTotal + freight,
          profit: acc.profit + (custAmount - suppAmount - myFreight),
        };
      },
      { totalKg: 0, customerTotal: 0, supplierTotal: 0, freightTotal: 0, profit: 0 }
    );
  }, [deliveries, customerPrice, supplierPrice]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDelivery.mutateAsync(id);
      toast.success("Fiş silindi");
    } catch {
      toast.error("Silme hatası");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          Henüz kantar fişi girilmedi.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Ticket Table */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Kantar Fişleri ({deliveries.length})</span>
            <Badge variant="secondary">
              {(summary.totalKg / 1000).toFixed(1)} ton
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tarih</TableHead>
                <TableHead className="text-xs">Fiş</TableHead>
                <TableHead className="text-xs text-right">Net (kg)</TableHead>
                <TableHead className="text-xs">Plaka</TableHead>
                <TableHead className="text-xs text-right">Nakliye</TableHead>
                <TableHead className="text-xs w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => {
                const custAmount =
                  d.freight_payer === "customer"
                    ? d.net_weight * customerPrice - (d.freight_cost || 0)
                    : d.net_weight * customerPrice;
                const suppAmount = d.net_weight * supplierPrice;

                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">
                      {formatDateShort(d.delivery_date)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {d.ticket_no || "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm">
                      {d.net_weight.toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {d.vehicle_plate || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {d.freight_cost ? (
                        <span>
                          {masked(d.freight_cost)}
                          <br />
                          <span className="text-muted-foreground">
                            {d.freight_payer === "customer"
                              ? "Müş."
                              : d.freight_payer === "supplier"
                              ? "Ürt."
                              : "Ben"}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50 transition-colors"
                        disabled={deleteDelivery.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Toplam</p>
              <p className="text-lg font-bold">
                {(summary.totalKg / 1000).toFixed(1)} <span className="text-sm font-normal">ton</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nakliye</p>
              <p className="text-lg font-bold">{masked(summary.freightTotal)}</p>
            </div>
          </div>
          <Separator className="my-2" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Müşteri Alacak</p>
              <p className="font-bold text-sm text-red-600">{masked(summary.customerTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Üretici Borç</p>
              <p className="font-bold text-sm text-green-600">{masked(summary.supplierTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kar</p>
              <p className={`font-bold text-sm ${summary.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                {masked(summary.profit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── HISTORY VIEW ────────────────────────────────────────────────
function HistoryView({
  onBack,
  selectedSaleId,
  onSelectSale,
  onLoadOrder,
}: {
  onBack: () => void;
  selectedSaleId: string | null;
  onSelectSale: (id: string | null) => void;
  onLoadOrder: (sale: Sale) => void;
}) {
  const { data: sales, isLoading } = useSales();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");

  const selectedSale = sales?.find((s) => s.id === selectedSaleId);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Geçmiş Siparişler</h1>
          <p className="text-sm text-muted-foreground">Tamamlanan satışlar</p>
        </div>
      </div>

      {selectedSaleId && selectedSale ? (
        <>
          <Button variant="outline" size="sm" onClick={() => onSelectSale(null)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Listeye Dön
          </Button>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{selectedSale.contact?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSale.feed_type?.name} · {selectedSale.sale_no}
                  </p>
                </div>
                <Badge variant="secondary">
                  {selectedSale.status === "delivered" ? "Teslim" : selectedSale.status === "confirmed" ? "Aktif" : "Taslak"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>{masked(selectedSale.total_amount)}</span>
                <span className="text-muted-foreground">{formatDateShort(selectedSale.sale_date)}</span>
              </div>
            </CardContent>
          </Card>
          <HistoryTicketList saleId={selectedSaleId} masked={masked} customerPrice={selectedSale.unit_price} />
        </>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sales && sales.length > 0 ? (
        <div className="space-y-2">
          {sales.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => onSelectSale(s.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{s.contact?.name || "—"}</p>
                      <Badge
                        variant="secondary"
                        className={
                          s.status === "delivered"
                            ? "bg-green-100 text-green-800"
                            : s.status === "confirmed"
                            ? "bg-blue-100 text-blue-800"
                            : s.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }
                      >
                        {s.status === "delivered" ? "Teslim" : s.status === "confirmed" ? "Aktif" : s.status === "cancelled" ? "İptal" : "Taslak"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.feed_type?.name} · {s.sale_no}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{masked(s.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(s.sale_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Henüz satış kaydı yok.
        </div>
      )}
    </div>
  );
}

// ─── HISTORY TICKET LIST (read-only) ─────────────────────────────
function HistoryTicketList({
  saleId,
  masked,
  customerPrice,
}: {
  saleId: string;
  masked: (amount: number) => string;
  customerPrice: number;
}) {
  const { data: deliveries, isLoading } = useDeliveriesBySale(saleId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Bu siparişe ait kantar fişi yok.
        </CardContent>
      </Card>
    );
  }

  const totalKg = deliveries.reduce((s, d) => s + d.net_weight, 0);
  const totalFreight = deliveries.reduce((s, d) => s + (d.freight_cost || 0), 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm">
            Kantar Fişleri ({deliveries.length}) · {(totalKg / 1000).toFixed(1)} ton
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tarih</TableHead>
                <TableHead className="text-xs">Fiş</TableHead>
                <TableHead className="text-xs text-right">Net (kg)</TableHead>
                <TableHead className="text-xs">Plaka</TableHead>
                <TableHead className="text-xs text-right">Nakliye</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs">{formatDateShort(d.delivery_date)}</TableCell>
                  <TableCell className="text-xs font-mono">{d.ticket_no || "—"}</TableCell>
                  <TableCell className="text-right font-bold text-sm">
                    {d.net_weight.toLocaleString("tr-TR")}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{d.vehicle_plate || "—"}</TableCell>
                  <TableCell className="text-xs text-right">
                    {d.freight_cost ? masked(d.freight_cost) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="p-3 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Toplam</p>
            <p className="font-bold">{(totalKg / 1000).toFixed(1)} ton</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nakliye</p>
            <p className="font-bold">{masked(totalFreight)}</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
