"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAllDeliveries } from "@/lib/hooks/use-all-deliveries";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useCarrierBalances } from "@/lib/hooks/use-carrier-transactions";
import { useRecentCarrierTransactions } from "@/lib/hooks/use-recent-carrier-transactions";
import {
  useUpdateDeliveryWithCarrierSync,
  useDeleteDeliveryWithTransactions,
} from "@/lib/hooks/use-delivery-with-transactions";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { useSeasonFilter } from "@/lib/contexts/season-context";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";
import { PlateCombobox } from "@/components/forms/plate-combobox";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatCurrency,
  formatDateShort,
  formatWeight,
  formatNumberInput,
  parseNumberInput,
  handleNumberChange,
} from "@/lib/utils/format";
import {
  buildSevkiyatMessage,
  formatPhoneForWhatsApp,
} from "@/lib/utils/whatsapp";
import type { TodayDelivery } from "@/lib/hooks/use-deliveries";
import type { FreightPayer } from "@/lib/types/database.types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  SlidersHorizontal,
  Banknote,
  Package,
  Users,
  Scale,
  DollarSign,
  ChevronRight,
  MessageCircle,
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

// ─── WhatsApp sent tracking ───
function isWhatsAppSent(deliveryId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`whatsapp_sent_${deliveryId}`) === "true";
}

function markWhatsAppSent(deliveryId: string) {
  localStorage.setItem(`whatsapp_sent_${deliveryId}`, "true");
}

// ─── Freight payer options ───
const FREIGHT_PAYER_OPTIONS: { value: FreightPayer; label: string }[] = [
  { value: "customer", label: "Müşteri" },
  { value: "me", label: "Ben" },
  { value: "supplier", label: "Üretici" },
];

const FREIGHT_PAYER_LABELS: Record<string, string> = {
  customer: "Müşteri",
  me: "Biz",
  supplier: "Üretici",
};

// ─── Types ───
type TabType = "deliveries" | "carrier";
type DateFilter = "today" | "week" | "month" | "all" | "custom";
type SortOption = "date_desc" | "date_asc" | "amount_desc" | "tonnage_desc";

const DATE_OPTIONS: { label: string; value: DateFilter }[] = [
  { label: "Bugün", value: "today" },
  { label: "Bu Hafta", value: "week" },
  { label: "Bu Ay", value: "month" },
  { label: "Tümü", value: "all" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Tarih ↓", value: "date_desc" },
  { label: "Tarih ↑", value: "date_asc" },
  { label: "Tutar ↓", value: "amount_desc" },
  { label: "Tonaj ↓", value: "tonnage_desc" },
];

// ─── Date helpers ───
function getDateRange(filter: DateFilter): { start: string; end: string } | null {
  if (filter === "all") return null;
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (filter === "today") return { start: today, end: today };

  if (filter === "week") {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    return { start: monday.toISOString().split("T")[0], end: today };
  }

  if (filter === "month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: firstDay.toISOString().split("T")[0], end: today };
  }

  return null;
}

export default function DeliveriesPage() {
  const [tab, setTab] = useState<TabType>("deliveries");

  return (
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sevkiyatlar</h1>
          <p className="text-sm text-muted-foreground">
            Tüm sevkiyat kayıtları ve nakliyeci cari
          </p>
        </div>
        <BalanceToggle />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {([
          { key: "deliveries" as TabType, label: "Sevkiyatlar" },
          { key: "carrier" as TabType, label: "Nakliyeci Cari" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deliveries" ? <DeliveriesTab /> : <CarrierTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Sevkiyatlar
// ═══════════════════════════════════════════════════════════════

function DeliveriesTab() {
  const { selectedSeasonId } = useSeasonFilter();
  const { data: deliveries, isLoading } = useAllDeliveries(selectedSeasonId);
  const { data: contacts } = useContacts("customer");
  const { data: feedTypes } = useFeedTypes(true);
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [feedTypeFilter, setFeedTypeFilter] = useState<string>("all");
  const [plateSearch, setPlateSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [showFilters, setShowFilters] = useState(false);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<TodayDelivery | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editFreightCost, setEditFreightCost] = useState("");
  const [editFreightPayer, setEditFreightPayer] = useState<FreightPayer>("customer");
  const [editDriverName, setEditDriverName] = useState("");
  const [editTicketNo, setEditTicketNo] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<TodayDelivery | null>(null);

  const updateMutation = useUpdateDeliveryWithCarrierSync();
  const deleteMutation = useDeleteDeliveryWithTransactions();

  // Filtered + sorted list
  const filtered = useMemo(() => {
    if (!deliveries) return [];
    let result = [...deliveries];

    // Date filter
    const range = getDateRange(dateFilter);
    if (range) {
      result = result.filter(
        (d) => d.delivery_date >= range.start && d.delivery_date <= range.end
      );
    }

    // Customer filter
    if (customerFilter !== "all") {
      result = result.filter((d) => d.sale?.contact_id === customerFilter);
    }

    // Feed type filter
    if (feedTypeFilter !== "all") {
      result = result.filter((d) => d.sale?.feed_type_id === feedTypeFilter);
    }

    // Plate search
    if (plateSearch.trim()) {
      const q = plateSearch.trim().toLowerCase();
      result = result.filter((d) =>
        d.vehicle_plate?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "date_asc") return a.delivery_date.localeCompare(b.delivery_date);
      if (sortBy === "amount_desc") {
        const amtA = a.net_weight * (a.sale?.unit_price || 0);
        const amtB = b.net_weight * (b.sale?.unit_price || 0);
        return amtB - amtA;
      }
      if (sortBy === "tonnage_desc") return b.net_weight - a.net_weight;
      // date_desc (default)
      return b.delivery_date.localeCompare(a.delivery_date) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [deliveries, dateFilter, customerFilter, feedTypeFilter, plateSearch, sortBy]);

  // Summary totals from filtered
  const totals = useMemo(() => {
    let totalTonnage = 0;
    let totalCustomerAmount = 0;
    let totalFreight = 0;

    filtered.forEach((d) => {
      totalTonnage += d.net_weight;
      totalCustomerAmount += d.net_weight * (d.sale?.unit_price || 0);
      totalFreight += d.freight_cost || 0;
    });

    return {
      count: filtered.length,
      tonnage: totalTonnage,
      customerAmount: totalCustomerAmount,
      totalFreight,
    };
  }, [filtered]);

  // Filter chips
  const chips: FilterChip[] = [];
  if (dateFilter !== "all") {
    const label = DATE_OPTIONS.find((o) => o.value === dateFilter)?.label || "";
    chips.push({ key: "date", label: "Tarih", value: label });
  }
  if (customerFilter !== "all") {
    const name = contacts?.find((c) => c.id === customerFilter)?.name || "";
    chips.push({ key: "customer", label: "Müşteri", value: name });
  }
  if (feedTypeFilter !== "all") {
    const name = feedTypes?.find((f) => f.id === feedTypeFilter)?.name || "";
    chips.push({ key: "feedType", label: "Yem", value: name });
  }
  if (plateSearch.trim()) {
    chips.push({ key: "plate", label: "Plaka", value: plateSearch.trim() });
  }
  if (sortBy !== "date_desc") {
    const label = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "";
    chips.push({ key: "sort", label: "Sıralama", value: label });
  }

  const handleRemoveChip = (key: string) => {
    if (key === "date") setDateFilter("all");
    if (key === "customer") setCustomerFilter("all");
    if (key === "feedType") setFeedTypeFilter("all");
    if (key === "plate") setPlateSearch("");
    if (key === "sort") setSortBy("date_desc");
  };

  const handleClearAll = () => {
    setDateFilter("all");
    setCustomerFilter("all");
    setFeedTypeFilter("all");
    setPlateSearch("");
    setSortBy("date_desc");
  };

  // Edit dialog handlers
  const openEdit = (d: TodayDelivery) => {
    setEditTarget(d);
    setEditWeight(formatNumberInput(String(d.net_weight)));
    setEditPlate(d.vehicle_plate || "");
    setEditFreightCost(d.freight_cost ? formatNumberInput(String(d.freight_cost)) : "");
    setEditFreightPayer((d.freight_payer as FreightPayer) || "customer");
    setEditDriverName(d.driver_name || "");
    setEditTicketNo(d.ticket_no || "");
    setEditNotes(d.notes || "");
  };

  const closeEdit = () => setEditTarget(null);

  const saveEdit = async () => {
    if (!editTarget) return;
    const newWeight = parseNumberInput(editWeight);
    if (newWeight <= 0) {
      toast.error("Ağırlık 0'dan büyük olmalı");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        net_weight: newWeight,
        vehicle_plate: editPlate || null,
        freight_cost: parseNumberInput(editFreightCost) || null,
        freight_payer: editFreightPayer,
        driver_name: editDriverName || null,
        ticket_no: editTicketNo || null,
        notes: editNotes || null,
      });
      toast.success("Sevkiyat güncellendi");
      closeEdit();
    } catch {
      toast.error("Güncelleme başarısız");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({
        deliveryId: deleteTarget.id,
        saleId: deleteTarget.sale_id,
        purchaseId: deleteTarget.purchase_id,
      });
      toast.success("Sevkiyat silindi");
      setDeleteTarget(null);
    } catch {
      toast.error("Silme başarısız");
    }
  };

  const hasActiveFilters = dateFilter !== "all" || customerFilter !== "all" || feedTypeFilter !== "all" || plateSearch.trim() || sortBy !== "date_desc";

  return (
    <>
      {/* Summary cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Sevkiyat</p>
              <p className="text-lg font-bold">{totals.count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Toplam Tonaj</p>
              <p className="text-lg font-bold">{formatWeight(totals.tonnage)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Müşteri Tutarı</p>
              <p className="text-lg font-bold text-green-600">
                {masked(totals.customerAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Toplam Nakliye</p>
              <p className="text-lg font-bold text-orange-600">
                {masked(totals.totalFreight)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Date filter pills */}
      <div className="flex gap-2 overflow-x-auto">
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDateFilter(opt.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              dateFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            showFilters ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="space-y-3 rounded-lg border p-3">
          {/* Customer */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Müşteri</p>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Feed type */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Yem Türü</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFeedTypeFilter("all")}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  feedTypeFilter === "all"
                    ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                    : "bg-muted/60 text-muted-foreground"
                }`}
              >
                Tümü
              </button>
              {feedTypes?.map((ft) => (
                <button
                  key={ft.id}
                  onClick={() => setFeedTypeFilter(ft.id)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    feedTypeFilter === ft.id
                      ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {ft.name}
                </button>
              ))}
            </div>
          </div>

          {/* Plate search */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Plaka</p>
            <Input
              placeholder="Plaka ara..."
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value)}
              className="h-9 font-mono"
            />
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Sıralama</p>
            <div className="flex gap-1.5 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    sortBy === opt.value
                      ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <FilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearAll} />

      {/* Delivery list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              masked={masked}
              onEdit={() => openEdit(d)}
              onDelete={() => setDeleteTarget(d)}
            />
          ))}
        </div>
      ) : hasActiveFilters ? (
        <EmptyState
          icon={Search}
          title="Sonuç bulunamadı"
          description="Filtre kriterlerini değiştirmeyi deneyin."
        />
      ) : (
        <EmptyState
          icon={Truck}
          title="Henüz sevkiyat kaydı yok"
          description="Satış sayfasından hızlı sevkiyat ekleyebilirsiniz."
        />
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sevkiyat Düzenle</DialogTitle>
            <DialogDescription>
              {editTarget?.sale?.contact?.name} — {editTarget && formatDateShort(editTarget.delivery_date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Net Ağırlık (kg)</Label>
                <Input
                  value={editWeight}
                  onChange={(e) =>
                    setEditWeight(formatNumberInput(handleNumberChange(e.target.value, false)))
                  }
                  className="mt-1 h-9"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label className="text-xs">Plaka</Label>
                <div className="mt-1">
                  <PlateCombobox value={editPlate} onChange={setEditPlate} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nakliye Tutarı (₺)</Label>
                <Input
                  value={editFreightCost}
                  onChange={(e) =>
                    setEditFreightCost(formatNumberInput(handleNumberChange(e.target.value, false)))
                  }
                  className="mt-1 h-9"
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Nakliye Ödeyen</Label>
                <Select value={editFreightPayer} onValueChange={(v) => setEditFreightPayer(v as FreightPayer)}>
                  <SelectTrigger className="mt-1 h-9">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Şoför Adı</Label>
                <Input
                  value={editDriverName}
                  onChange={(e) => setEditDriverName(e.target.value)}
                  className="mt-1 h-9"
                  placeholder="Şoför adı"
                />
              </div>
              <div>
                <Label className="text-xs">Fiş No</Label>
                <Input
                  value={editTicketNo}
                  onChange={(e) => setEditTicketNo(e.target.value)}
                  className="mt-1 h-9"
                  placeholder="Fiş numarası"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notlar</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Not ekleyin..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>İptal</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sevkiyatı Sil</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  {formatDateShort(deleteTarget.delivery_date)} tarihli,{" "}
                  {formatWeight(deleteTarget.net_weight)} sevkiyat silinecek.
                  İlgili cari hesap işlemleri de geri alınacaktır. Bu işlem geri alınamaz.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Delivery Card (detailed display with WhatsApp)
// ═══════════════════════════════════════════════════════════════

function DeliveryCard({
  delivery: d,
  masked,
  onEdit,
  onDelete,
}: {
  delivery: TodayDelivery;
  masked: (amount: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const customerAmount = d.net_weight * (d.sale?.unit_price || 0);
  const phone = d.sale?.contact?.phone;
  const hasPhone = !!formatPhoneForWhatsApp(phone);
  const [waSent, setWaSent] = useState(() => isWhatsAppSent(d.id));

  const handleWhatsApp = () => {
    if (!phone) return;
    const msg = buildSevkiyatMessage({
      customerName: d.sale?.contact?.name || "",
      date: d.delivery_date,
      netWeight: d.net_weight,
      feedType: d.sale?.feed_type?.name,
      plate: d.vehicle_plate || undefined,
      driverName: d.driver_name,
      unitPrice: d.sale?.unit_price,
      freightCost: d.freight_cost,
    });
    const waPhone = formatPhoneForWhatsApp(phone);
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    markWhatsAppSent(d.id);
    setWaSent(true);
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-1.5">
        {/* Row 1: Date + Feed type badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatDateShort(d.delivery_date)}
            </span>
            {d.sale?.feed_type?.name && (
              <Badge variant="secondary" className="text-xs">
                {d.sale.feed_type.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Row 2: Customer name + Amount */}
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm truncate">
            {d.sale?.contact?.name || "—"}
          </p>
          <p className="font-semibold text-sm shrink-0 ml-2">
            {masked(customerAmount)}
          </p>
        </div>

        {/* Row 3: Weight · Plate · Ticket no */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-semibold text-foreground">
            {formatWeight(d.net_weight)}
          </span>
          {d.vehicle_plate && (
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
              {d.vehicle_plate}
            </span>
          )}
          {d.ticket_no && (
            <span>Fiş: {d.ticket_no}</span>
          )}
        </div>

        {/* Row 4: Driver · Freight cost · Freight payer */}
        {(d.driver_name || d.freight_cost) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {d.driver_name && (
              <span>Şoför: {d.driver_name}</span>
            )}
            {d.freight_cost != null && d.freight_cost > 0 && (
              <span>Nakliye: {formatCurrency(d.freight_cost)}</span>
            )}
            {d.freight_payer && d.freight_payer !== "customer" && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {FREIGHT_PAYER_LABELS[d.freight_payer] || d.freight_payer}
              </Badge>
            )}
          </div>
        )}

        {/* Actions: WhatsApp + Edit + Delete */}
        <div className="flex items-center justify-end gap-1 pt-0.5">
          {hasPhone && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleWhatsApp}
            >
              <MessageCircle
                className={`h-4 w-4 ${
                  waSent
                    ? "text-green-300"
                    : "text-green-600"
                }`}
              />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: Nakliyeci Cari
// ═══════════════════════════════════════════════════════════════

function CarrierTab() {
  const { data: balances, isLoading: balancesLoading } = useCarrierBalances();
  const { data: recentTxs, isLoading: txsLoading } = useRecentCarrierTransactions(20);
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");

  // Summary from balances
  const summary = useMemo(() => {
    if (!balances) return { totalFreight: 0, totalPaid: 0, balance: 0 };
    let totalFreight = 0;
    let totalPaid = 0;
    let balance = 0;
    balances.forEach((b) => {
      totalFreight += b.total_freight;
      totalPaid += b.total_paid;
      balance += b.balance;
    });
    return { totalFreight, totalPaid, balance };
  }, [balances]);

  return (
    <>
      {/* Summary cards */}
      {!balancesLoading && balances && balances.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Toplam Nakliye</p>
              <p className="text-sm font-bold">{masked(summary.totalFreight)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Ödenen</p>
              <p className="text-sm font-bold text-green-600">
                {masked(summary.totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Kalan Borç</p>
              <p className="text-sm font-bold text-red-600">
                {masked(summary.balance)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Carrier list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Nakliyeciler
        </h2>
        {balancesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : balances && balances.length > 0 ? (
          <div className="space-y-2">
            {balances.map((b) => (
              <Link key={b.id} href={`/settings/carriers/${b.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{b.name}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Nakliye: {masked(b.total_freight)}</span>
                          <span>Ödenen: {masked(b.total_paid)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <p
                          className={`font-bold text-sm ${
                            b.balance > 0
                              ? "text-red-600"
                              : b.balance < 0
                                ? "text-green-600"
                                : ""
                          }`}
                        >
                          {masked(Math.abs(b.balance))}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Truck}
            title="Nakliyeci bulunamadı"
            description="Ayarlar sayfasından nakliyeci ekleyebilirsiniz."
          />
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Son İşlemler
        </h2>
        {txsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recentTxs && recentTxs.length > 0 ? (
          <div className="space-y-1.5">
            {recentTxs.map((tx) => (
              <Card key={tx.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {tx.type === "freight_charge" ? (
                        <Truck className="h-4 w-4 shrink-0 text-red-500" />
                      ) : (
                        <Banknote className="h-4 w-4 shrink-0 text-green-500" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.carrier_name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDateShort(tx.transaction_date)}
                          {tx.description && ` · ${tx.description}`}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-semibold text-sm shrink-0 ml-2 ${
                        tx.type === "freight_charge"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {tx.type === "freight_charge" ? "+" : "-"}
                      {masked(tx.amount)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Henüz işlem yok
          </p>
        )}
      </div>
    </>
  );
}
