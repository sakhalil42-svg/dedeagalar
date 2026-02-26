"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSales, useCreateSale } from "@/lib/hooks/use-sales";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useDeliveriesBySale, useUpdateDelivery } from "@/lib/hooks/use-deliveries";
import { useCreateDeliveryWithTransactions } from "@/lib/hooks/use-delivery-with-transactions";
import { useDeleteDelivery } from "@/lib/hooks/use-deliveries";
import {
  useDeliveryPhotos,
  useUploadDeliveryPhoto,
} from "@/lib/hooks/use-delivery-photos";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import { formatCurrency, formatDateShort, formatNumberInput, parseNumberInput, handleNumberChange } from "@/lib/utils/format";
import type { Sale, Delivery, FreightPayer, Contact, PricingModel } from "@/lib/types/database.types";
import { PlateCombobox } from "@/components/forms/plate-combobox";

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
  Loader2,
  Check,
  Trash2,
  History,
  ChevronLeft,
  Scale,
  Truck,
  Users,
  Camera,
  X,
  MessageCircle,
  Phone,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { openWhatsAppMessage, buildSevkiyatMessage } from "@/lib/utils/whatsapp";

// ─── FREIGHT PAYER OPTIONS ───────────────────────────────────────
const FREIGHT_PAYER_OPTIONS: { value: FreightPayer; label: string }[] = [
  { value: "customer", label: "Müşteri" },
  { value: "me", label: "Ben" },
  { value: "supplier", label: "Üretici" },
];

// ─── LOCAL STORAGE HELPERS ───────────────────────────────────────
const LS_KEY = "hizli_sevkiyat_last";

interface LastConfig {
  customerId: string;
  supplierId: string;
  feedTypeId: string;
  customerPrice: string;
  supplierPrice: string;
  pricingModel: PricingModel;
}

function loadLastConfig(): Partial<LastConfig> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveLastConfig(config: LastConfig) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {}
}

// ─── TYPES ───────────────────────────────────────────────────────
interface OrderConfig {
  customerId: string;
  supplierId: string;
  feedTypeId: string;
  customerPrice: string;
  supplierPrice: string;
  pricingModel: PricingModel;
  saleId: string | null;
  purchaseId: string | null;
}

// ─── WHATSAPP HELPER ─────────────────────────────────────────────
function buildWhatsAppUrl(
  customerPhone: string | null,
  delivery: Delivery
): string | null {
  if (!customerPhone) return null;

  let phone = customerPhone.replace(/[\s\-()]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "90" + phone.slice(1);
  if (!phone.startsWith("90") && phone.length === 10) phone = "90" + phone;

  let msg: string;
  if (delivery.freight_payer === "customer") {
    msg =
      `🚛 Sevkiyat Bilgisi\n` +
      (delivery.carrier_name ? `Nakliyeci: ${delivery.carrier_name}\n` : "") +
      (delivery.vehicle_plate ? `Plaka: ${delivery.vehicle_plate}\n` : "") +
      (delivery.carrier_phone ? `Telefon: ${delivery.carrier_phone}\n` : "") +
      `Net Ağırlık: ${delivery.net_weight.toLocaleString("tr-TR")} kg\n` +
      (delivery.freight_cost
        ? `Nakliye Bedeli: ${delivery.freight_cost.toLocaleString("tr-TR")} ₺\n`
        : "") +
      `Ödeme nakliyeciye yapılacaktır.`;
  } else {
    msg =
      `🚛 Sevkiyat Bilgisi\n` +
      (delivery.carrier_name ? `Nakliyeci: ${delivery.carrier_name}\n` : "") +
      (delivery.vehicle_plate ? `Plaka: ${delivery.vehicle_plate}\n` : "") +
      (delivery.carrier_phone ? `Telefon: ${delivery.carrier_phone}\n` : "") +
      `Net Ağırlık: ${delivery.net_weight.toLocaleString("tr-TR")} kg`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
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
    pricingModel: "nakliye_dahil",
    saleId: null,
    purchaseId: null,
  });
  const [selectedHistorySaleId, setSelectedHistorySaleId] = useState<string | null>(null);

  // Load last config from localStorage AFTER mount (avoid hydration mismatch)
  useEffect(() => {
    const last = loadLastConfig();
    if (last.customerId || last.supplierId || last.feedTypeId) {
      setOrder((prev) => ({
        ...prev,
        customerId: last.customerId || prev.customerId,
        supplierId: last.supplierId || prev.supplierId,
        feedTypeId: last.feedTypeId || prev.feedTypeId,
        customerPrice: last.customerPrice || prev.customerPrice,
        supplierPrice: last.supplierPrice || prev.supplierPrice,
        pricingModel: last.pricingModel || prev.pricingModel,
      }));
    }
  }, []);

  // Save to localStorage when order config changes
  useEffect(() => {
    if (order.customerId || order.supplierId || order.feedTypeId) {
      saveLastConfig({
        customerId: order.customerId,
        supplierId: order.supplierId,
        feedTypeId: order.feedTypeId,
        customerPrice: order.customerPrice,
        supplierPrice: order.supplierPrice,
        pricingModel: order.pricingModel,
      });
    }
  }, [order.customerId, order.supplierId, order.feedTypeId, order.customerPrice, order.supplierPrice, order.pricingModel]);

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
            pricingModel: "nakliye_dahil",
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

  const matchingSale = useMemo(() => {
    if (!allSales || !order.customerId || !order.feedTypeId) return null;
    return (
      allSales.find(
        (s) =>
          s.contact_id === order.customerId &&
          s.feed_type_id === order.feedTypeId &&
          s.status !== "cancelled" &&
          s.status !== "delivered"
      ) || null
    );
  }, [allSales, order.customerId, order.feedTypeId]);

  const activeSaleId = order.saleId || matchingSale?.id || null;
  const effectiveCustomerPrice =
    order.customerPrice || (matchingSale ? String(matchingSale.unit_price) : "");

  const isOrderReady =
    order.customerId &&
    order.supplierId &&
    order.feedTypeId &&
    effectiveCustomerPrice &&
    order.supplierPrice;

  const ensureSaleExists = useCallback(async (): Promise<string | null> => {
    if (activeSaleId) return activeSaleId;
    if (!order.customerId || !order.feedTypeId || !effectiveCustomerPrice) return null;

    try {
      const result = await createSale.mutateAsync({
        contact_id: order.customerId,
        feed_type_id: order.feedTypeId,
        quantity: 1,
        unit: "kg",
        unit_price: parseFloat(effectiveCustomerPrice),
        sale_date: new Date().toISOString().split("T")[0],
      });
      setOrder((prev) => ({ ...prev, saleId: result.id }));
      return result.id;
    } catch {
      toast.error("Satış kaydı oluşturulamadı");
      return null;
    }
  }, [activeSaleId, order.customerId, order.feedTypeId, effectiveCustomerPrice, createSale, setOrder]);

  const customerContact = customers?.find((c) => c.id === order.customerId);
  const supplierName = suppliers?.find((c) => c.id === order.supplierId)?.name;
  const feedTypeName = feedTypes?.find((f) => f.id === order.feedTypeId)?.name;

  const handleResetAll = () => {
    setOrder({
      customerId: "",
      supplierId: "",
      feedTypeId: "",
      customerPrice: "",
      supplierPrice: "",
      pricingModel: "nakliye_dahil",
      saleId: null,
      purchaseId: null,
    });
  };

  return (
    <div className="flex flex-col pb-4">
      {/* ─── HEADER ─── */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="flex items-center justify-between p-4 pb-2">
          <div>
            <h1 className="text-xl font-bold">Hızlı Sevkiyat</h1>
            <p className="text-xs text-muted-foreground">
              Kantar fişi gir, cari otomatik işlensin
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BalanceToggle />
            <Button variant="outline" size="sm" onClick={onShowHistory}>
              <History className="mr-1 h-4 w-4" />
              Geçmiş
            </Button>
          </div>
        </div>

        {/* ─── ORDER CONFIG ─── */}
        <div className="px-4 pb-3 space-y-3">
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
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
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
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Müşteri ₺/kg</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={formatNumberInput(effectiveCustomerPrice)}
                onChange={(e) => {
                  setOrder((p) => ({ ...p, customerPrice: handleNumberChange(e.target.value, true) }));
                }}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Üretici ₺/kg</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={formatNumberInput(order.supplierPrice)}
                onChange={(e) => {
                  setOrder((p) => ({ ...p, supplierPrice: handleNumberChange(e.target.value, true) }));
                }}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Pricing Model Toggle + Reset */}
          <div className="flex gap-2 items-center">
            <div className="flex gap-1 flex-1">
              <button
                type="button"
                onClick={() => setOrder((p) => ({ ...p, pricingModel: "nakliye_dahil" }))}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  order.pricingModel === "nakliye_dahil"
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Nakliye Dahil
              </button>
              <button
                type="button"
                onClick={() => setOrder((p) => ({ ...p, pricingModel: "tir_ustu" }))}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  order.pricingModel === "tir_ustu"
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Tır Üstü
              </button>
            </div>
            {isOrderReady && (
              <Button variant="ghost" size="sm" onClick={handleResetAll} className="text-xs text-muted-foreground h-8 px-2">
                <RotateCcw className="mr-1 h-3 w-3" />
                Sıfırla
              </Button>
            )}
          </div>

          {isOrderReady && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Users className="mr-1 h-3 w-3" />
                {customerContact?.name}
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
            <QuickEntryForm
              saleId={activeSaleId}
              purchaseId={order.purchaseId}
              customerContactId={order.customerId}
              supplierContactId={order.supplierId}
              customerPrice={parseFloat(effectiveCustomerPrice)}
              supplierPrice={parseFloat(order.supplierPrice)}
              pricingModel={order.pricingModel}
              ensureSaleExists={ensureSaleExists}
              customerContact={customerContact || null}
              feedTypeName={feedTypeName || undefined}
            />

            {activeSaleId && (
              <TicketListAndSummary
                saleId={activeSaleId}
                customerPrice={parseFloat(effectiveCustomerPrice)}
                supplierPrice={parseFloat(order.supplierPrice)}
                pricingModel={order.pricingModel}
                masked={masked}
                customerContact={customerContact || null}
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
  pricingModel,
  ensureSaleExists,
  customerContact,
  feedTypeName,
}: {
  saleId: string | null;
  purchaseId: string | null;
  customerContactId: string;
  supplierContactId: string;
  customerPrice: number;
  supplierPrice: number;
  pricingModel: PricingModel;
  ensureSaleExists: () => Promise<string | null>;
  customerContact: Contact | null;
  feedTypeName?: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [ticketNo, setTicketNo] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [freightPayer, setFreightPayer] = useState<FreightPayer>("me");
  const [saving, setSaving] = useState(false);
  const [lastTicketNo, setLastTicketNo] = useState("");

  const createDeliveryTx = useCreateDeliveryWithTransactions();

  const handleVehicleSelect = useCallback((info: {
    plate: string;
    driverName: string;
    carrierName: string;
    carrierPhone: string;
  }) => {
    setVehiclePlate(info.plate);
    if (info.carrierName) setCarrierName(info.carrierName);
    if (info.carrierPhone) setCarrierPhone(info.carrierPhone);
    if (info.driverName) setDriverName(info.driverName);
  }, []);

  // 3.2 — Only clear per-ticket fields, keep carrier/freight settings
  const resetForNextTicket = () => {
    setNetWeight("");
    setVehiclePlate("");
    // Auto-increment ticket no
    if (ticketNo) {
      setLastTicketNo(ticketNo);
      const match = ticketNo.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        const padded = String(num).padStart(match[2].length, "0");
        setTicketNo(prefix + padded);
      } else {
        setTicketNo("");
      }
    }
    // Keep: date, carrierName, carrierPhone, freightCost, freightPayer, driverName
  };

  // 3.6 — Net weight handler: prevent leading zeros, only digits
  const handleNetWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    // Remove leading zeros
    const cleaned = raw.replace(/^0+/, "") || "";
    setNetWeight(cleaned);
  };

  // Format display value with thousand separator
  const displayWeight = netWeight
    ? parseInt(netWeight, 10).toLocaleString("tr-TR")
    : "";

  const handleSave = async () => {
    const kg = parseInt(netWeight, 10);
    if (!kg || kg <= 0) {
      toast.error("Net ağırlık giriniz");
      return;
    }

    setSaving(true);
    try {
      const resolvedSaleId = await ensureSaleExists();
      if (!resolvedSaleId) return;

      const delivery = await createDeliveryTx.mutateAsync({
        delivery: {
          sale_id: resolvedSaleId,
          purchase_id: purchaseId,
          delivery_date: date,
          ticket_no: ticketNo || null,
          net_weight: kg,
          vehicle_plate: vehiclePlate || null,
          driver_name: driverName || null,
          carrier_name: carrierName || null,
          carrier_phone: carrierPhone || null,
          freight_cost: freightCost ? parseFloat(freightCost) : null,
          freight_payer: freightCost ? freightPayer : null,
        },
        customerContactId,
        supplierContactId,
        customerPrice,
        supplierPrice,
        pricingModel,
      });

      // 3.2 — Detailed success toast with WhatsApp action
      const savedDate = date;
      const savedPlate = vehiclePlate;
      if (customerContact?.phone) {
        toast.success(
          `Kaydedildi — ${kg.toLocaleString("tr-TR")} kg${savedPlate ? `, ${savedPlate}` : ""}`,
          {
            duration: 5000,
            action: {
              label: "WhatsApp Bildir",
              onClick: () => {
                openWhatsAppMessage(
                  customerContact.phone,
                  buildSevkiyatMessage({
                    customerName: customerContact.name,
                    date: savedDate,
                    netWeight: kg,
                    feedType: feedTypeName,
                    plate: savedPlate || undefined,
                  })
                );
              },
            },
          }
        );
      } else {
        toast.success(
          `Kaydedildi — ${kg.toLocaleString("tr-TR")} kg${savedPlate ? `, ${savedPlate}` : ""}`,
          { duration: 2000 }
        );
      }
      resetForNextTicket();
      setTimeout(() => {
        document.getElementById("net-weight-input")?.focus();
      }, 100);
    } catch (err) {
      toast.error(
        "Kayıt hatası: " + (err instanceof Error ? err.message : "Bilinmeyen hata")
      );
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
            <Label className="text-xs text-muted-foreground">
              Fiş No
              {lastTicketNo && (
                <span className="ml-1 text-muted-foreground/60">(son: {lastTicketNo})</span>
              )}
            </Label>
            <Input
              placeholder="Opsiyonel"
              value={ticketNo}
              onChange={(e) => setTicketNo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Row 2: NET WEIGHT — 3.6 formatted input */}
        <div>
          <Label className="text-xs text-muted-foreground">Net Ağırlık (kg)</Label>
          <div className="relative">
            <input
              id="net-weight-input"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={displayWeight}
              onChange={handleNetWeightChange}
              className="flex h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-2xl font-bold text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {netWeight && parseInt(netWeight) >= 1000 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {(parseInt(netWeight) / 1000).toFixed(2)} ton
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Plate + Freight */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Araç Plakası</Label>
            <PlateCombobox
              value={vehiclePlate}
              onChange={setVehiclePlate}
              onVehicleSelect={handleVehicleSelect}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nakliye (₺)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={freightCost ? formatNumberInput(freightCost) : ""}
              onChange={(e) => setFreightCost(handleNumberChange(e.target.value, true))}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Row 4: Carrier Name + Phone */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nakliyeci Adı</Label>
            <Input
              placeholder="İsim"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              <Phone className="inline h-3 w-3 mr-0.5" />
              Nakliyeci Tel
            </Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="05XX XXX XXXX"
              value={carrierPhone}
              onChange={(e) => setCarrierPhone(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Row 5: Freight Payer toggle */}
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

        {/* Preview */}
        {netWeight && parseInt(netWeight) > 0 && (() => {
          const kg = parseInt(netWeight);
          const freight = freightCost ? parseFloat(freightCost) : 0;
          const custAmount = freightPayer === "customer" ? kg * customerPrice - freight : kg * customerPrice;
          const suppAmount = pricingModel === "nakliye_dahil" && freightPayer !== "supplier"
            ? kg * supplierPrice - freight
            : kg * supplierPrice;
          const myFreight = pricingModel === "nakliye_dahil"
            ? (freightPayer === "me" ? freight : 0)
            : (freightPayer === "me" ? freight : 0);
          const profit = custAmount - suppAmount - myFreight;

          return (
            <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Müşteri alacak:</span>
                <span className="font-medium">{formatCurrency(custAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Üretici borç:</span>
                <span className="font-medium">{formatCurrency(suppAmount)}</span>
              </div>
              {myFreight > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nakliye (benim):</span>
                  <span className="font-medium text-red-600">-{formatCurrency(myFreight)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kar:</span>
                <span className={`font-bold ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrency(profit)}
                </span>
              </div>
            </div>
          );
        })()}

        <Button
          onClick={handleSave}
          disabled={saving || !netWeight || parseInt(netWeight) <= 0}
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
  pricingModel,
  masked,
  customerContact,
}: {
  saleId: string;
  customerPrice: number;
  supplierPrice: number;
  pricingModel: PricingModel;
  masked: (amount: number) => string;
  customerContact: Contact | null;
}) {
  const { data: deliveries, isLoading } = useDeliveriesBySale(saleId);
  const deleteDelivery = useDeleteDelivery();

  const summary = useMemo(() => {
    if (!deliveries)
      return { totalKg: 0, customerTotal: 0, supplierTotal: 0, freightTotal: 0, myFreightTotal: 0, profit: 0 };
    return deliveries.reduce(
      (acc, d) => {
        const freight = d.freight_cost || 0;
        const custAmount =
          d.freight_payer === "customer"
            ? d.net_weight * customerPrice - freight
            : d.net_weight * customerPrice;
        const suppAmount = pricingModel === "nakliye_dahil" && d.freight_payer !== "supplier"
          ? d.net_weight * supplierPrice - freight
          : d.net_weight * supplierPrice;
        const myFreight = d.freight_payer === "me" ? freight : 0;

        return {
          totalKg: acc.totalKg + d.net_weight,
          customerTotal: acc.customerTotal + custAmount,
          supplierTotal: acc.supplierTotal + suppAmount,
          freightTotal: acc.freightTotal + freight,
          myFreightTotal: acc.myFreightTotal + myFreight,
          profit: acc.profit + (custAmount - suppAmount - myFreight),
        };
      },
      { totalKg: 0, customerTotal: 0, supplierTotal: 0, freightTotal: 0, myFreightTotal: 0, profit: 0 }
    );
  }, [deliveries, customerPrice, supplierPrice, pricingModel]);

  const handleDelete = async (id: string) => {
    if (!confirm("Bu sevkiyatı silmek istediğinize emin misiniz?\nCari bakiye otomatik güncellenecektir.")) return;
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
      {/* Ticket Cards */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Kantar Fişleri ({deliveries.length})</span>
            <Badge variant="secondary">{(summary.totalKg / 1000).toFixed(1)} ton</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {deliveries.map((d) => (
            <TicketRow
              key={d.id}
              delivery={d}
              customerContact={customerContact}
              masked={masked}
              onDelete={() => handleDelete(d.id)}
              isDeleting={deleteDelivery.isPending}
            />
          ))}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Toplam</p>
              <p className="text-lg font-bold">
                {(summary.totalKg / 1000).toFixed(1)}{" "}
                <span className="text-sm font-normal">ton</span>
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
              <p
                className={`font-bold text-sm ${
                  summary.profit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {masked(summary.profit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── SINGLE TICKET ROW (with edit) ──────────────────────────────
function TicketRow({
  delivery,
  customerContact,
  masked,
  onDelete,
  isDeleting,
}: {
  delivery: Delivery;
  customerContact: Contact | null;
  masked: (amount: number) => string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editWeight, setEditWeight] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editFreight, setEditFreight] = useState("");
  const [editFreightPayer, setEditFreightPayer] = useState<FreightPayer>("me");
  const [editCarrier, setEditCarrier] = useState("");
  const [editCarrierPhone, setEditCarrierPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos } = useDeliveryPhotos(delivery.id);
  const uploadPhoto = useUploadDeliveryPhoto();
  const updateDelivery = useUpdateDelivery();

  const waUrl = buildWhatsAppUrl(customerContact?.phone || null, delivery);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        await uploadPhoto.mutateAsync({ deliveryId: delivery.id, file });
        toast.success("Fotoğraf yüklendi");
      } catch {
        toast.error("Fotoğraf yüklenemedi");
      }
    }
    e.target.value = "";
  };

  // 3.3 — Open edit mode
  const startEdit = () => {
    setEditWeight(String(delivery.net_weight));
    setEditPlate(delivery.vehicle_plate || "");
    setEditFreight(delivery.freight_cost ? String(delivery.freight_cost) : "");
    setEditFreightPayer((delivery.freight_payer as FreightPayer) || "me");
    setEditCarrier(delivery.carrier_name || "");
    setEditCarrierPhone(delivery.carrier_phone || "");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    const kg = parseInt(editWeight, 10);
    if (!kg || kg <= 0) {
      toast.error("Geçerli ağırlık giriniz");
      return;
    }
    try {
      await updateDelivery.mutateAsync({
        id: delivery.id,
        net_weight: kg,
        vehicle_plate: editPlate || null,
        freight_cost: editFreight ? parseFloat(editFreight) : null,
        freight_payer: editFreight ? editFreightPayer : null,
        carrier_name: editCarrier || null,
        carrier_phone: editCarrierPhone || null,
      });
      toast.success("Fiş güncellendi");
      setEditing(false);
    } catch {
      toast.error("Güncelleme hatası");
    }
  };

  if (editing) {
    return (
      <div className="px-3 py-3 space-y-2 bg-amber-50/50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-amber-800">Düzenle</p>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Net Ağırlık (kg)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={editWeight ? formatNumberInput(editWeight) : ""}
              onChange={(e) => setEditWeight(handleNumberChange(e.target.value, false))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Plaka</Label>
            <Input
              value={editPlate}
              onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nakliye (₺)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={editFreight ? formatNumberInput(editFreight) : ""}
              onChange={(e) => setEditFreight(handleNumberChange(e.target.value, true))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ödeyen</Label>
            <Select value={editFreightPayer} onValueChange={(v) => setEditFreightPayer(v as FreightPayer)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREIGHT_PAYER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nakliyeci</Label>
            <Input
              value={editCarrier}
              onChange={(e) => setEditCarrier(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tel</Label>
            <Input
              type="tel"
              value={editCarrierPhone}
              onChange={(e) => setEditCarrierPhone(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveEdit} disabled={updateDelivery.isPending} className="flex-1">
            {updateDelivery.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
            Kaydet
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            İptal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 py-2.5 space-y-2">
        {/* Main row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDateShort(delivery.delivery_date)}</span>
              {delivery.ticket_no && (
                <span className="font-mono">#{delivery.ticket_no}</span>
              )}
              {delivery.vehicle_plate && (
                <span className="font-mono">{delivery.vehicle_plate}</span>
              )}
            </div>
            <p className="text-lg font-bold">
              {delivery.net_weight.toLocaleString("tr-TR")} kg
            </p>
            {delivery.freight_cost ? (
              <p className="text-xs text-muted-foreground">
                Nakliye: {masked(delivery.freight_cost)} ·{" "}
                {delivery.freight_payer === "customer"
                  ? "Müşteri"
                  : delivery.freight_payer === "supplier"
                  ? "Üretici"
                  : "Ben"}
                {delivery.carrier_name && ` · ${delivery.carrier_name}`}
              </p>
            ) : delivery.carrier_name ? (
              <p className="text-xs text-muted-foreground">{delivery.carrier_name}</p>
            ) : null}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* WhatsApp */}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-md text-green-600 hover:bg-green-50 transition-colors"
                title="WhatsApp ile gönder"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            )}

            {/* Camera / Photo */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
              disabled={uploadPhoto.isPending}
              title="Fotoğraf ekle"
            >
              {uploadPhoto.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Edit — 3.3 */}
            <button
              onClick={startEdit}
              className="flex h-8 w-8 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50 transition-colors"
              title="Düzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors"
              disabled={isDeleting}
              title="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Photo thumbnails */}
        {photos && photos.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {photos.map((p) => (
              <button
                key={p.name}
                onClick={() => setLightboxUrl(p.url)}
                className="shrink-0 h-12 w-12 rounded-md overflow-hidden border hover:ring-2 ring-primary transition-all"
              >
                <img
                  src={p.url}
                  alt="Kantar fişi"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 h-12 w-12 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Kantar fişi"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
  const { data: allContacts } = useContacts();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");

  // 3.7 — Filters
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [contactFilter, setContactFilter] = useState("");

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    let list = [...sales];

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      list = list.filter((s) => {
        const d = new Date(s.sale_date);
        if (dateFilter === "today") return d >= today;
        if (dateFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return d >= weekAgo;
        }
        if (dateFilter === "month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return d >= monthAgo;
        }
        return true;
      });
    }

    // Contact filter
    if (contactFilter) {
      list = list.filter((s) => s.contact_id === contactFilter);
    }

    return list;
  }, [sales, dateFilter, contactFilter]);

  // Summary for filtered
  const totalAmount = filteredSales.reduce((s, sale) => s + (sale.total_amount || 0), 0);

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
                  {selectedSale.status === "delivered"
                    ? "Teslim"
                    : selectedSale.status === "confirmed"
                    ? "Aktif"
                    : "Taslak"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>{masked(selectedSale.total_amount)}</span>
                <span className="text-muted-foreground">
                  {formatDateShort(selectedSale.sale_date)}
                </span>
              </div>
            </CardContent>
          </Card>
          <HistoryTicketList
            saleId={selectedSaleId}
            masked={masked}
            customerPhone={selectedSale.contact?.phone || null}
          />
        </>
      ) : (
        <>
          {/* 3.7 — Filters */}
          <div className="space-y-2">
            <div className="flex gap-1">
              {([
                { key: "all", label: "Tümü" },
                { key: "today", label: "Bugün" },
                { key: "week", label: "Bu Hafta" },
                { key: "month", label: "Bu Ay" },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setDateFilter(f.key)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    dateFilter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {allContacts && allContacts.length > 0 && (
              <Select value={contactFilter || "all_contacts"} onValueChange={(v) => setContactFilter(v === "all_contacts" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Tüm müşteriler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_contacts">Tüm müşteriler</SelectItem>
                  {allContacts
                    .filter((c) => c.type === "customer" || c.type === "both")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Summary */}
            {filteredSales.length > 0 && (
              <Card>
                <CardContent className="p-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{filteredSales.length} sipariş</span>
                  <span className="font-bold">{masked(totalAmount)}</span>
                </CardContent>
              </Card>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSales.length > 0 ? (
            <div className="space-y-2">
              {filteredSales.map((s) => (
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
                            {s.status === "delivered"
                              ? "Teslim"
                              : s.status === "confirmed"
                              ? "Aktif"
                              : s.status === "cancelled"
                              ? "İptal"
                              : "Taslak"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {s.feed_type?.name} · {s.sale_no}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{masked(s.total_amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(s.sale_date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {dateFilter !== "all" || contactFilter ? "Filtreye uygun sonuç yok." : "Henüz satış kaydı yok."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── HISTORY TICKET LIST (read-only with photos + whatsapp) ──────
function HistoryTicketList({
  saleId,
  masked,
  customerPhone,
}: {
  saleId: string;
  masked: (amount: number) => string;
  customerPhone: string | null;
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
        <CardContent className="p-0 divide-y">
          {deliveries.map((d) => (
            <HistoryTicketRow
              key={d.id}
              delivery={d}
              customerPhone={customerPhone}
              masked={masked}
            />
          ))}
        </CardContent>
      </Card>

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

// ─── HISTORY TICKET ROW (read-only) ──────────────────────────────
function HistoryTicketRow({
  delivery,
  customerPhone,
  masked,
}: {
  delivery: Delivery;
  customerPhone: string | null;
  masked: (amount: number) => string;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const { data: photos } = useDeliveryPhotos(delivery.id);

  const waUrl = buildWhatsAppUrl(customerPhone, delivery);

  return (
    <>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDateShort(delivery.delivery_date)}</span>
              {delivery.ticket_no && (
                <span className="font-mono">#{delivery.ticket_no}</span>
              )}
              {delivery.vehicle_plate && (
                <span className="font-mono">{delivery.vehicle_plate}</span>
              )}
            </div>
            <p className="text-lg font-bold">
              {delivery.net_weight.toLocaleString("tr-TR")} kg
            </p>
            {delivery.freight_cost ? (
              <p className="text-xs text-muted-foreground">
                Nakliye: {masked(delivery.freight_cost)} ·{" "}
                {delivery.freight_payer === "customer"
                  ? "Müşteri"
                  : delivery.freight_payer === "supplier"
                  ? "Üretici"
                  : "Ben"}
                {delivery.carrier_name && ` · ${delivery.carrier_name}`}
              </p>
            ) : delivery.carrier_name ? (
              <p className="text-xs text-muted-foreground">{delivery.carrier_name}</p>
            ) : null}
          </div>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-md text-green-600 hover:bg-green-50 transition-colors shrink-0"
              title="WhatsApp ile gönder"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Photo thumbnails */}
        {photos && photos.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {photos.map((p) => (
              <button
                key={p.name}
                onClick={() => setLightboxUrl(p.url)}
                className="shrink-0 h-12 w-12 rounded-md overflow-hidden border hover:ring-2 ring-primary transition-all"
              >
                <img
                  src={p.url}
                  alt="Kantar fişi"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Kantar fişi"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
