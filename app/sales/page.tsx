"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSales, useCreateSale } from "@/lib/hooks/use-sales";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useDeliveriesBySale, useUpdateDelivery, useTodayDeliveries } from "@/lib/hooks/use-deliveries";
import type { TodayDelivery } from "@/lib/hooks/use-deliveries";
import {
  useCreateDeliveryWithTransactions,
  useUpdateDeliveryWithCarrierSync,
  useDeleteDeliveryWithTransactions,
  useCancelSale,
  useReassignSale,
  useReturnDelivery,
} from "@/lib/hooks/use-delivery-with-transactions";
import {
  useDeliveryPhotos,
  useUploadDeliveryPhoto,
} from "@/lib/hooks/use-delivery-photos";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import { formatCurrency, formatDateShort, formatNumberInput, parseNumberInput, handleNumberChange } from "@/lib/utils/format";
import type { Sale, Delivery, FreightPayer, Contact, PricingModel } from "@/lib/types/database.types";
import { PlateCombobox } from "@/components/forms/plate-combobox";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";
import { useSeasonFilter } from "@/lib/contexts/season-context";

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
  Ban,
  UserPlus,
  Undo2,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/lib/utils/whatsapp";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

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
  customerName: string,
  delivery: Delivery,
  customerPrice: number,
  feedTypeName?: string,
): string | null {
  if (!customerPhone) return null;

  const phone = formatPhoneForWhatsApp(customerPhone);
  if (!phone) return null;

  const total = delivery.net_weight * customerPrice;
  const msg =
    `Sayın ${customerName},\n` +
    `${formatDateShort(delivery.delivery_date)} tarihinde ${delivery.net_weight.toLocaleString("tr-TR")} kg ${feedTypeName || "yem"} yüklenmiştir.\n` +
    (delivery.vehicle_plate ? `Plaka: ${delivery.vehicle_plate}\n` : "") +
    `Birim Fiyat: ${customerPrice.toLocaleString("tr-TR")} ₺/kg\n` +
    `Tutar: ${total.toLocaleString("tr-TR")} ₺\n` +
    `Dedeağalar Grup`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ─── WHATSAPP SENT TRACKING ──────────────────────────────────────
function isWhatsAppSent(deliveryId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`whatsapp_sent_${deliveryId}`) === "true";
}

function markWhatsAppSent(deliveryId: string) {
  localStorage.setItem(`whatsapp_sent_${deliveryId}`, "true");
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
  const { selectedSeasonId } = useSeasonFilter();
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
        status: "delivered",
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
              seasonId={selectedSeasonId}
            />

            {activeSaleId && (
              <TicketListAndSummary
                saleId={activeSaleId}
                customerPrice={parseFloat(effectiveCustomerPrice)}
                supplierPrice={parseFloat(order.supplierPrice)}
                pricingModel={order.pricingModel}
                masked={masked}
                customerContact={customerContact || null}
                feedTypeName={feedTypeName}
              />
            )}
          </>
        )}

        {/* ─── BUGÜNKÜ SEVKİYATLAR ─── */}
        <TodayDeliveriesList masked={masked} />
      </div>
    </div>
  );
}

// ─── TODAY'S DELIVERIES LIST ─────────────────────────────────────
function TodayDeliveriesList({ masked }: { masked: (amount: number) => string }) {
  const { data: todayDeliveries, isLoading } = useTodayDeliveries();
  const deleteDelivery = useDeleteDeliveryWithTransactions();
  const updateDelivery = useUpdateDelivery();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editPlate, setEditPlate] = useState("");

  const handleDelete = async (d: TodayDelivery) => {
    if (!confirm("Bu sevkiyatı silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDelivery.mutateAsync({
        deliveryId: d.id,
        saleId: d.sale_id,
        purchaseId: d.purchase_id,
      });
      toast.success("Fiş silindi");
    } catch {
      toast.error("Silme hatası");
    }
  };

  const startEdit = (d: TodayDelivery) => {
    setEditingId(d.id);
    setEditWeight(String(d.net_weight));
    setEditPlate(d.vehicle_plate || "");
  };

  const saveEdit = async (d: TodayDelivery) => {
    const w = parseInt(editWeight);
    if (!w || w <= 0) {
      toast.error("Geçerli ağırlık giriniz");
      return;
    }
    try {
      await updateDelivery.mutateAsync({
        id: d.id,
        net_weight: w,
        vehicle_plate: editPlate || null,
      });
      toast.success("Güncellendi");
      setEditingId(null);
    } catch {
      toast.error("Güncelleme hatası");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Filter only positive weight (exclude returns)
  const deliveries = (todayDeliveries || []).filter((d) => d.net_weight > 0);

  if (deliveries.length === 0) return null;

  const totalKg = deliveries.reduce((s, d) => s + d.net_weight, 0);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            Bugünkü Sevkiyatlar ({deliveries.length})
          </span>
          <Badge variant="secondary">{(totalKg / 1000).toFixed(1)} ton</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y">
        {deliveries.map((d) => {
          const customerName = d.sale?.contact?.name || "—";
          const customerPhone = d.sale?.contact?.phone || null;
          const feedName = d.sale?.feed_type?.name || "";
          const unitPrice = d.sale?.unit_price || 0;
          const amount = d.net_weight * unitPrice;
          const isEditing = editingId === d.id;

          const waUrl = customerPhone
            ? buildWhatsAppUrl(customerPhone, customerName, d, unitPrice, feedName)
            : null;

          return (
            <TodayDeliveryRow
              key={d.id}
              delivery={d}
              customerName={customerName}
              feedName={feedName}
              amount={amount}
              waUrl={waUrl}
              masked={masked}
              isEditing={isEditing}
              editWeight={editWeight}
              editPlate={editPlate}
              onEditWeight={setEditWeight}
              onEditPlate={setEditPlate}
              onStartEdit={() => startEdit(d)}
              onSaveEdit={() => saveEdit(d)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => handleDelete(d)}
              isDeleting={deleteDelivery.isPending}
              isSaving={updateDelivery.isPending}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── TODAY DELIVERY ROW ──────────────────────────────────────────
function TodayDeliveryRow({
  delivery,
  customerName,
  feedName,
  amount,
  waUrl,
  masked,
  isEditing,
  editWeight,
  editPlate,
  onEditWeight,
  onEditPlate,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isDeleting,
  isSaving,
}: {
  delivery: TodayDelivery;
  customerName: string;
  feedName: string;
  amount: number;
  waUrl: string | null;
  masked: (amount: number) => string;
  isEditing: boolean;
  editWeight: string;
  editPlate: string;
  onEditWeight: (v: string) => void;
  onEditPlate: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isSaving: boolean;
}) {
  const [waSent, setWaSent] = useState(() => isWhatsAppSent(delivery.id));

  if (isEditing) {
    return (
      <div className="px-3 py-2.5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Ağırlık (kg)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={editWeight}
              onChange={(e) => onEditWeight(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Plaka</Label>
            <Input
              value={editPlate}
              onChange={(e) => onEditPlate(e.target.value.toUpperCase())}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSaveEdit} disabled={isSaving} className="h-7 text-xs">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
            Kaydet
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 text-xs">
            İptal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold truncate">{customerName}</p>
          {feedName && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
              {feedName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-bold text-foreground">
            {delivery.net_weight.toLocaleString("tr-TR")} kg
          </span>
          {delivery.vehicle_plate && (
            <span className="font-mono">{delivery.vehicle_plate}</span>
          )}
          {delivery.ticket_no && (
            <span className="font-mono">#{delivery.ticket_no}</span>
          )}
        </div>
      </div>

      {/* Amount */}
      <p className="text-sm font-bold shrink-0">{masked(amount)}</p>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              waSent
                ? "text-muted-foreground/50 hover:bg-muted/50"
                : "text-green-600 hover:bg-green-50"
            }`}
            title={waSent ? "WhatsApp gönderildi" : "WhatsApp ile bildir"}
            onClick={() => {
              markWhatsAppSent(delivery.id);
              setWaSent(true);
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {waSent && (
              <Check className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-green-600" />
            )}
          </a>
        )}
        <button
          onClick={onStartEdit}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
          title="Düzenle"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors"
          title="Sil"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
  seasonId,
}: {
  saleId: string | null;
  purchaseId: string | null;
  customerContactId: string;
  supplierContactId: string;
  customerPrice: number;
  supplierPrice: number;
  pricingModel: PricingModel;
  ensureSaleExists: () => Promise<string | null>;
  seasonId?: string | null;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [ticketNo, setTicketNo] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
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
    driverPhone: string;
    carrierName: string;
    carrierPhone: string;
  }) => {
    setVehiclePlate(info.plate);
    setDriverName(info.driverName || "");
    setDriverPhone(info.driverPhone || "");
    setCarrierName(info.carrierName || "");
    setCarrierPhone(info.carrierPhone || "");
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

      const supabase = (await import("@/lib/supabase/client")).createClient();
      const plate = vehiclePlate.trim().toUpperCase() || null;
      const resolvedCarrierName = carrierName.trim() || null;

      // A) Nakliyeci bul/oluştur
      let resolvedCarrierId: string | null = null;
      if (resolvedCarrierName) {
        const { data: existingCarrier, error: findErr } = await supabase
          .from("carriers")
          .select("id")
          .ilike("name", resolvedCarrierName)
          .eq("is_active", true)
          .maybeSingle();

        if (existingCarrier) {
          resolvedCarrierId = existingCarrier.id;
        } else {
          const { data: newCarrier, error: insertErr } = await supabase
            .from("carriers")
            .insert({ name: resolvedCarrierName, is_active: true })
            .select("id")
            .single();

          if (newCarrier) resolvedCarrierId = newCarrier.id;
        }
      }
      // B) Araç bul/oluştur ve nakliyeciye bağla
      if (plate) {
        // Plaka DB'de boşluklu saklanıyor (ör: "42 BN 010"), exact match kullan
        const { data: existingVehicle, error: vehErr } = await supabase
          .from("vehicles")
          .select("id, carrier_id")
          .eq("plate", plate)
          .maybeSingle();

        if (existingVehicle) {
          // Araç var → şoför bilgilerini ve carrier_id güncelle (her zaman üstüne yaz)
          const updates: Record<string, unknown> = {};
          if (driverName.trim()) updates.driver_name = driverName.trim();
          if (driverPhone.trim()) updates.driver_phone = driverPhone.trim();
          if (resolvedCarrierId) updates.carrier_id = resolvedCarrierId;
          if (Object.keys(updates).length > 0) {
            const { error: updErr } = await supabase
              .from("vehicles")
              .update(updates)
              .eq("id", existingVehicle.id);
          }
        } else {
          // Araç yok → yeni oluştur
          const { error: insErr } = await supabase
            .from("vehicles")
            .insert({
              plate,
              driver_name: driverName.trim() || null,
              driver_phone: driverPhone.trim() || null,
              carrier_id: resolvedCarrierId,
            });
        }
      }

      // C) Delivery kaydı
      await createDeliveryTx.mutateAsync({
        delivery: {
          sale_id: resolvedSaleId,
          purchase_id: purchaseId,
          delivery_date: date,
          ticket_no: ticketNo || null,
          net_weight: kg,
          vehicle_plate: plate,
          driver_name: driverName.trim() || null,
          carrier_name: resolvedCarrierName,
          carrier_phone: carrierPhone.trim() || null,
          freight_cost: freightCost ? parseFloat(freightCost) : null,
          freight_payer: freightCost ? freightPayer : null,
        },
        customerContactId,
        supplierContactId,
        customerPrice,
        supplierPrice,
        pricingModel,
        seasonId,
      });

      toast.success(
        `Kaydedildi — ${kg.toLocaleString("tr-TR")} kg${plate ? `, ${plate}` : ""}`,
        { duration: 2000 }
      );
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

        {/* Row 4: Şoför Adı + Şoför Tel */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Şoför Adı</Label>
            <Input
              placeholder="Şoför adı"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              <Phone className="inline h-3 w-3 mr-0.5" />
              Şoför Tel
            </Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="05XX XXX XXXX"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Row 5: Nakliyeci */}
        <div>
          <Label className="text-xs text-muted-foreground">Nakliyeci (firma/patron)</Label>
          <Input
            placeholder="Nakliyeci adı"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            className="h-9 text-sm"
          />
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

        {/* Plaka varsa nakliyeci zorunlu uyarısı */}
        {vehiclePlate.trim() && !carrierName.trim() && (
          <p className="text-xs text-red-500">
            Plaka girildiğinde nakliyeci adı zorunludur.
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={
            saving ||
            !netWeight ||
            isNaN(parseInt(netWeight, 10)) ||
            parseInt(netWeight, 10) <= 0 ||
            (!!vehiclePlate.trim() && !carrierName.trim())
          }
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
  feedTypeName,
}: {
  saleId: string;
  customerPrice: number;
  supplierPrice: number;
  pricingModel: PricingModel;
  masked: (amount: number) => string;
  customerContact: Contact | null;
  feedTypeName?: string;
}) {
  const { data: deliveries, isLoading } = useDeliveriesBySale(saleId);
  const deleteDelivery = useDeleteDeliveryWithTransactions();

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

  const handleDelete = async (d: Delivery) => {
    if (!confirm("Bu sevkiyatı silmek istediğinize emin misiniz?\nCari bakiye otomatik güncellenecektir.")) return;
    try {
      await deleteDelivery.mutateAsync({
        deliveryId: d.id,
        saleId: d.sale_id,
        purchaseId: d.purchase_id,
      });
      toast.success("Fiş silindi");
    } catch {
      toast.error("Silme hatası");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
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
              customerPrice={customerPrice}
              feedTypeName={feedTypeName}
              masked={masked}
              onDelete={() => handleDelete(d)}
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
  customerPrice,
  feedTypeName,
  masked,
  onDelete,
  isDeleting,
}: {
  delivery: Delivery;
  customerContact: Contact | null;
  customerPrice: number;
  feedTypeName?: string;
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
  const [editDriverName, setEditDriverName] = useState("");
  const [editCarrier, setEditCarrier] = useState("");
  const [editCarrierPhone, setEditCarrierPhone] = useState("");
  const [waSent, setWaSent] = useState(() => isWhatsAppSent(delivery.id));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos } = useDeliveryPhotos(delivery.id);
  const uploadPhoto = useUploadDeliveryPhoto();
  const updateDelivery = useUpdateDeliveryWithCarrierSync();

  const waUrl = customerContact?.phone
    ? buildWhatsAppUrl(customerContact.phone, customerContact.name, delivery, customerPrice, feedTypeName)
    : null;

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
    setEditDriverName(delivery.driver_name || "");
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
        driver_name: editDriverName || null,
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
            <Label className="text-xs text-muted-foreground">Şoför</Label>
            <Input
              value={editDriverName}
              onChange={(e) => setEditDriverName(e.target.value)}
              className="h-8 text-sm"
              placeholder="Şoför adı"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nakliyeci</Label>
            <Input
              value={editCarrier}
              onChange={(e) => setEditCarrier(e.target.value)}
              className="h-8 text-sm"
              placeholder="Firma/patron"
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
            {delivery.driver_name && (
              <p className="text-xs text-muted-foreground">
                Şoför: {delivery.driver_name}
              </p>
            )}
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
              <p className="text-xs text-muted-foreground">Nakliyeci: {delivery.carrier_name}</p>
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
                className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  waSent
                    ? "text-muted-foreground/50 hover:bg-muted/50"
                    : "text-green-600 hover:bg-green-50"
                }`}
                title={waSent ? "WhatsApp gönderildi" : "WhatsApp ile bildir"}
                onClick={() => {
                  markWhatsAppSent(delivery.id);
                  setWaSent(true);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                {waSent && (
                  <Check className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-green-600" />
                )}
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
  const cancelSale = useCancelSale();
  const reassignSale = useReassignSale();
  const returnDelivery = useReturnDelivery();

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelNote, setCancelNote] = useState("");

  // Reassign dialog
  const [reassignTarget, setReassignTarget] = useState<Sale | null>(null);
  const [reassignCustomerId, setReassignCustomerId] = useState("");
  const [reassignPrice, setReassignPrice] = useState("");

  // Return dialog
  const [returnTarget, setReturnTarget] = useState<Delivery | null>(null);
  const [returnKg, setReturnKg] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);

  // Actions menu
  const [showActionsFor, setShowActionsFor] = useState<string | null>(null);

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      await cancelSale.mutateAsync({
        saleId: cancelTarget.id,
        cancelNote: cancelNote || undefined,
      });
      toast.success("Sipariş iptal edildi, cari hesaplar güncellendi");
      setCancelTarget(null);
      setCancelNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İptal hatası");
    }
  }

  async function handleReassign() {
    if (!reassignTarget || !reassignCustomerId) {
      toast.error("Müşteri seçiniz");
      return;
    }
    try {
      await reassignSale.mutateAsync({
        saleId: reassignTarget.id,
        newCustomerId: reassignCustomerId,
        newPrice: reassignPrice ? parseFloat(reassignPrice) : undefined,
      });
      toast.success("Sipariş yeni müşteriye atandı");
      setReassignTarget(null);
      setReassignCustomerId("");
      setReassignPrice("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Atama hatası");
    }
  }

  async function handleReturn() {
    if (!returnTarget) return;
    const kg = parseInt(returnKg);
    if (!kg || kg <= 0) {
      toast.error("İade miktarı giriniz");
      return;
    }
    if (kg > returnTarget.net_weight) {
      toast.error("İade miktarı sevkiyat miktarını aşamaz");
      return;
    }
    try {
      await returnDelivery.mutateAsync({
        deliveryId: returnTarget.id,
        returnKg: kg,
        returnNote: returnNote || undefined,
        returnDate,
      });
      toast.success("İade kaydedildi, cari hesaplar güncellendi");
      setReturnTarget(null);
      setReturnKg("");
      setReturnNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İade hatası");
    }
  }

  // 3.7 — Filters
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [contactFilter, setContactFilter] = useState("");
  const [feedTypeFilter, setFeedTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: allFeedTypes } = useFeedTypes();

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
        if (dateFilter === "custom") {
          if (startDate) {
            const s2 = new Date(startDate);
            s2.setHours(0, 0, 0, 0);
            if (d < s2) return false;
          }
          if (endDate) {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            if (d > e) return false;
          }
        }
        return true;
      });
    }

    // Contact filter
    if (contactFilter) {
      list = list.filter((s) => s.contact_id === contactFilter);
    }

    // Feed type filter
    if (feedTypeFilter) {
      list = list.filter((s) => s.feed_type_id === feedTypeFilter);
    }

    return list;
  }, [sales, dateFilter, contactFilter, feedTypeFilter, startDate, endDate]);

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
                <Badge
                  variant="secondary"
                  className={
                    selectedSale.status === "delivered"
                      ? "bg-green-100 text-green-800"
                      : selectedSale.status === "confirmed"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }
                >
                  {selectedSale.status === "delivered"
                    ? "Tamamlandı"
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
              {/* Action buttons */}
              {selectedSale.status !== "cancelled" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      setReassignTarget(selectedSale);
                      setReassignPrice(String(selectedSale.unit_price));
                    }}
                  >
                    <UserPlus className="mr-1 h-3 w-3" />
                    Müşteri Değiştir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-destructive"
                    onClick={() => setCancelTarget(selectedSale)}
                  >
                    <Ban className="mr-1 h-3 w-3" />
                    İptal Et
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <HistoryTicketList
            saleId={selectedSaleId}
            masked={masked}
            customerPhone={selectedSale.contact?.phone || null}
            customerName={selectedSale.contact?.name || ""}
            customerPrice={selectedSale.unit_price || 0}
            feedTypeName={selectedSale.feed_type?.name}
            onReturn={(d) => setReturnTarget(d)}
          />
        </>
      ) : (
        <>
          {/* 3.7 — Filters */}
          <div className="space-y-2">
            {/* Date filter pills + advanced toggle */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {([
                  { key: "all" as const, label: "Tümü" },
                  { key: "today" as const, label: "Bugün" },
                  { key: "week" as const, label: "Hafta" },
                  { key: "month" as const, label: "Ay" },
                  { key: "custom" as const, label: "Özel" },
                ]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setDateFilter(f.key)}
                    className={`flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors ${
                      dateFilter === f.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                  showAdvancedFilters ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Custom date range */}
            {dateFilter === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Başlangıç</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Bitiş</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            )}

            {/* Customer filter */}
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

            {/* Advanced filters panel */}
            {showAdvancedFilters && (
              <div className="space-y-2 rounded-lg border p-3">
                {/* Feed type filter */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Yem Türü</p>
                  <Select value={feedTypeFilter || "all"} onValueChange={(v) => setFeedTypeFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Tüm yem türleri" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm yem türleri</SelectItem>
                      {(allFeedTypes || []).map((ft) => (
                        <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Filter chips */}
            {(() => {
              const histChips: FilterChip[] = [];
              if (dateFilter !== "all" && dateFilter !== "custom") {
                const dLabel = dateFilter === "today" ? "Bugün" : dateFilter === "week" ? "Bu Hafta" : "Bu Ay";
                histChips.push({ key: "date", label: "Tarih", value: dLabel });
              }
              if (dateFilter === "custom" && (startDate || endDate)) {
                histChips.push({ key: "date", label: "Tarih", value: `${startDate || "..."} - ${endDate || "..."}` });
              }
              if (contactFilter) {
                const cName = allContacts?.find((c) => c.id === contactFilter)?.name || "";
                histChips.push({ key: "contact", label: "Müşteri", value: cName });
              }
              if (feedTypeFilter) {
                const ftName = allFeedTypes?.find((ft) => ft.id === feedTypeFilter)?.name || "";
                histChips.push({ key: "feedType", label: "Yem", value: ftName });
              }
              return (
                <FilterChips
                  chips={histChips}
                  onRemove={(key) => {
                    if (key === "date") { setDateFilter("all"); setStartDate(""); setEndDate(""); }
                    if (key === "contact") setContactFilter("");
                    if (key === "feedType") setFeedTypeFilter("");
                  }}
                  onClearAll={() => {
                    setDateFilter("all");
                    setContactFilter("");
                    setFeedTypeFilter("");
                    setStartDate("");
                    setEndDate("");
                  }}
                />
              );
            })()}

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
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
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
                              ? "Tamamlandı"
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
            dateFilter !== "all" || contactFilter || feedTypeFilter ? (
              <EmptyState
                icon={Search}
                title="Filtreye uygun sonuç yok"
                description="Arama kriterlerini değiştirmeyi deneyin."
              />
            ) : (
              <EmptyState
                icon={Truck}
                title="Henüz satış kaydı yok"
                description="Yeni satış ekleyerek başlayın."
              />
            )
          )}
        </>
      )}

      {/* ── Cancel Dialog ── */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sipariş İptal</DialogTitle>
            <DialogDescription>
              {cancelTarget?.sale_no} — {cancelTarget?.contact?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu siparişin tüm cari hesap işlemleri geri alınacaktır.
            </p>
            <div>
              <Label>İptal Nedeni (opsiyonel)</Label>
              <Textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Neden iptal ediliyor..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Vazgeç</Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelSale.isPending}
            >
              {cancelSale.isPending ? "İptal ediliyor..." : "İptal Et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reassign Dialog ── */}
      <Dialog open={!!reassignTarget} onOpenChange={(o) => !o && setReassignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteri Değiştir</DialogTitle>
            <DialogDescription>
              {reassignTarget?.sale_no} — mevcut: {reassignTarget?.contact?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Yeni Müşteri *</Label>
              <Select value={reassignCustomerId || "pick"} onValueChange={(v) => setReassignCustomerId(v === "pick" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Müşteri seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pick" disabled>Müşteri seçiniz</SelectItem>
                  {allContacts
                    ?.filter((c) => c.type === "customer" || c.type === "both")
                    .filter((c) => c.id !== reassignTarget?.contact_id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Yeni Birim Fiyat (₺/kg)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={reassignPrice}
                onChange={(e) => setReassignPrice(e.target.value)}
                placeholder="Değişmezse boş bırakın"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignTarget(null)}>Vazgeç</Button>
            <Button
              onClick={handleReassign}
              disabled={reassignSale.isPending || !reassignCustomerId}
            >
              {reassignSale.isPending ? "Kaydediliyor..." : "Müşteriyi Değiştir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return Dialog ── */}
      <Dialog open={!!returnTarget} onOpenChange={(o) => !o && setReturnTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İade Kaydı</DialogTitle>
            <DialogDescription>
              Orijinal sevkiyat: {returnTarget?.net_weight.toLocaleString("tr-TR")} kg
              {returnTarget?.delivery_date && ` · ${formatDateShort(returnTarget.delivery_date)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>İade Miktarı (kg) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={returnKg}
                onChange={(e) => setReturnKg(e.target.value)}
                placeholder={`Maks: ${returnTarget?.net_weight.toLocaleString("tr-TR")} kg`}
              />
            </div>
            <div>
              <Label>İade Tarihi</Label>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Not (opsiyonel)</Label>
              <Textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="İade nedeni..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>Vazgeç</Button>
            <Button
              onClick={handleReturn}
              disabled={returnDelivery.isPending}
            >
              {returnDelivery.isPending ? "Kaydediliyor..." : "İade Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── HISTORY TICKET LIST (read-only with photos + whatsapp) ──────
function HistoryTicketList({
  saleId,
  masked,
  customerPhone,
  customerName,
  customerPrice,
  feedTypeName,
  onReturn,
}: {
  saleId: string;
  masked: (amount: number) => string;
  customerPhone: string | null;
  customerName: string;
  customerPrice: number;
  feedTypeName?: string;
  onReturn: (delivery: Delivery) => void;
}) {
  const { data: deliveries, isLoading } = useDeliveriesBySale(saleId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="Kantar fişi yok"
        description="Bu siparişe ait kantar fişi bulunamadı."
      />
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
              customerName={customerName}
              customerPrice={customerPrice}
              feedTypeName={feedTypeName}
              masked={masked}
              onReturn={onReturn}
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
  customerName,
  customerPrice,
  feedTypeName,
  masked,
  onReturn,
}: {
  delivery: Delivery;
  customerPhone: string | null;
  customerName: string;
  customerPrice: number;
  feedTypeName?: string;
  masked: (amount: number) => string;
  onReturn: (delivery: Delivery) => void;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [waSent, setWaSent] = useState(() => isWhatsAppSent(delivery.id));
  const { data: photos } = useDeliveryPhotos(delivery.id);

  const waUrl = customerPhone
    ? buildWhatsAppUrl(customerPhone, customerName, delivery, customerPrice, feedTypeName)
    : null;

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
            {delivery.driver_name && (
              <p className="text-xs text-muted-foreground">
                Şoför: {delivery.driver_name}
              </p>
            )}
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
              <p className="text-xs text-muted-foreground">Nakliyeci: {delivery.carrier_name}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  waSent
                    ? "text-muted-foreground/50 hover:bg-muted/50"
                    : "text-green-600 hover:bg-green-50"
                }`}
                title={waSent ? "WhatsApp gönderildi" : "WhatsApp ile bildir"}
                onClick={() => {
                  markWhatsAppSent(delivery.id);
                  setWaSent(true);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                {waSent && (
                  <Check className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-green-600" />
                )}
              </a>
            )}
            {delivery.net_weight > 0 && (
              <button
                onClick={() => onReturn(delivery)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50 transition-colors"
                title="İade"
              >
                <Undo2 className="h-4 w-4" />
              </button>
            )}
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
