"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAllDeliveries } from "@/lib/hooks/use-all-deliveries";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useVehicles } from "@/lib/hooks/use-vehicles";
import { useCarrierBalances } from "@/lib/hooks/use-carrier-transactions";
import { useRecentCarrierTransactions } from "@/lib/hooks/use-recent-carrier-transactions";
import {
  useUpdateDeliveryWithCarrierSync,
  useDeleteDeliveryWithTransactions,
} from "@/lib/hooks/use-delivery-with-transactions";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { useSeasonFilter } from "@/lib/contexts/season-context";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";
import { PlateCombobox } from "@/components/forms/plate-combobox";
import { SkeletonCard } from "@/components/ui/skeleton";
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Loader2,
  SlidersHorizontal,
  Banknote,
  Scale,
  TrendingUp,
  ChevronRight,
  MessageCircle,
  AlertTriangle,
  Plus,
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
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {([
          { key: "deliveries" as TabType, label: "Sevkiyatlar" },
          { key: "carrier" as TabType, label: "Nakliyeci Cari" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
  const { data: vehicles } = useVehicles();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");

  const vehiclePhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    vehicles?.forEach((v) => {
      if (v.plate && v.driver_phone) map.set(v.plate, v.driver_phone);
    });
    return map;
  }, [vehicles]);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [feedTypeFilter, setFeedTypeFilter] = useState<string>("all");
  const [plateSearch, setPlateSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<TodayDelivery | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editFreightCost, setEditFreightCost] = useState("");
  const [editFreightPayer, setEditFreightPayer] = useState<FreightPayer>("customer");
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverPhone, setEditDriverPhone] = useState("");
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

    const range = getDateRange(dateFilter);
    if (range) {
      result = result.filter(
        (d) => d.delivery_date >= range.start && d.delivery_date <= range.end
      );
    }

    if (customerFilter !== "all") {
      result = result.filter((d) => d.sale?.contact_id === customerFilter);
    }

    if (feedTypeFilter !== "all") {
      result = result.filter((d) => d.sale?.feed_type_id === feedTypeFilter);
    }

    if (plateSearch.trim()) {
      const q = plateSearch.trim().toLowerCase();
      result = result.filter((d) =>
        d.vehicle_plate?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date_asc") return a.delivery_date.localeCompare(b.delivery_date);
      if (sortBy === "amount_desc") {
        const amtA = a.net_weight * (a.sale?.unit_price || 0);
        const amtB = b.net_weight * (b.sale?.unit_price || 0);
        return amtB - amtA;
      }
      if (sortBy === "tonnage_desc") return b.net_weight - a.net_weight;
      return b.delivery_date.localeCompare(a.delivery_date) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [deliveries, dateFilter, customerFilter, feedTypeFilter, plateSearch, sortBy]);

  // Summary totals
  const totals = useMemo(() => {
    let totalTonnage = 0;
    let totalCustomerAmount = 0;
    let totalFreight = 0;
    let totalProfit = 0;

    filtered.forEach((d) => {
      totalTonnage += d.net_weight;
      const customerAmt = d.net_weight * (d.sale?.unit_price || 0);
      totalCustomerAmount += customerAmt;
      totalFreight += d.freight_cost || 0;
      // Simple profit calc: customer amount - freight (approximate)
      totalProfit += customerAmt;
    });

    return {
      count: filtered.length,
      tonnage: totalTonnage,
      customerAmount: totalCustomerAmount,
      totalFreight,
      totalProfit,
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
    setEditDriverPhone(d.driver_phone || "");
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
        driver_phone: editDriverPhone || null,
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
      {/* Header row with search + filter icons */}
      <div className="flex items-center gap-2">
        {searchOpen ? (
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Plaka ara..."
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value)}
              className="pl-9 rounded-xl bg-muted border-0 font-mono"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setPlateSearch(""); }}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            searchOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Search className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            showFilters || hasActiveFilters ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Date filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDateFilter(opt.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              dateFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="space-y-3 rounded-xl border p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Müşteri</p>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Yem Türü</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFeedTypeFilter("all")}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  feedTypeFilter === "all"
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground"
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
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ft.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Sıralama</p>
            <div className="flex gap-1.5 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    sortBy === opt.value
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted text-muted-foreground"
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

      {/* Summary cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-card p-3 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 mb-1.5">
              <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam Adet</p>
            <p className="text-lg font-extrabold">{totals.count}</p>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 mb-1.5">
              <Scale className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Top. Tonaj</p>
            <p className="text-lg font-extrabold">{formatWeight(totals.tonnage)}</p>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 mb-1.5">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam Tutar</p>
            <p className="text-lg font-extrabold text-green-600">{masked(totals.customerAmount)}</p>
          </div>
        </div>
      )}

      {/* Delivery list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              masked={masked}
              vehiclePhoneMap={vehiclePhoneMap}
              onEdit={() => openEdit(d)}
              onDelete={() => setDeleteTarget(d)}
            />
          ))}
        </div>
      ) : hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-muted/30 p-6 mb-6">
            <Search className="h-16 w-16 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">Sonuç Bulunamadı</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            Filtre kriterlerini değiştirmeyi deneyin.
          </p>
          <button
            onClick={handleClearAll}
            className="mt-4 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white"
          >
            Filtreleri Temizle
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative rounded-2xl bg-muted/30 p-6 mb-6">
            <Truck className="h-16 w-16 text-primary" />
            <div className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-bold mt-2">Henüz Sevkiyat Bulunmuyor</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            Bugün için kaydedilmiş bir sevkiyatınız yok. Yeni bir sevkiyat ekleyerek işlerinizi takip etmeye başlayabilirsiniz.
          </p>
          <Link
            href="/sales"
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Hızlı Sevkiyat Ekle
          </Link>
        </div>
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
                  className="mt-1 h-9 rounded-xl"
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
                  className="mt-1 h-9 rounded-xl"
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Nakliye Ödeyen</Label>
                <Select value={editFreightPayer} onValueChange={(v) => setEditFreightPayer(v as FreightPayer)}>
                  <SelectTrigger className="mt-1 h-9 rounded-xl">
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
                  className="mt-1 h-9 rounded-xl"
                  placeholder="Şoför adı"
                />
              </div>
              <div>
                <Label className="text-xs">Şoför Telefon</Label>
                <Input
                  value={editDriverPhone}
                  onChange={(e) => setEditDriverPhone(e.target.value)}
                  className="mt-1 h-9 rounded-xl"
                  placeholder="05xx xxx xx xx"
                  inputMode="tel"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Fiş No</Label>
              <Input
                value={editTicketNo}
                onChange={(e) => setEditTicketNo(e.target.value)}
                className="mt-1 h-9 rounded-xl"
                placeholder="Fiş numarası"
              />
            </div>
            <div>
              <Label className="text-xs">Notlar</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1 rounded-xl"
                rows={2}
                placeholder="Not ekleyin..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} className="rounded-xl">İptal</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending} className="rounded-xl">
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="rounded-xl"
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
// Delivery Card — Stitch Style
// ═══════════════════════════════════════════════════════════════

function DeliveryCard({
  delivery: d,
  masked,
  vehiclePhoneMap,
  onEdit,
  onDelete,
}: {
  delivery: TodayDelivery;
  masked: (amount: number) => string;
  vehiclePhoneMap: Map<string, string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const customerAmount = d.net_weight * (d.sale?.unit_price || 0);
  const phone = d.sale?.contact?.phone;
  const hasPhone = !!formatPhoneForWhatsApp(phone);
  const [waSent, setWaSent] = useState(() => isWhatsAppSent(d.id));

  const driverPhone = d.driver_phone || (d.vehicle_plate ? vehiclePhoneMap.get(d.vehicle_plate) : undefined) || null;

  const handleWhatsApp = () => {
    if (!phone) return;
    const msg = buildSevkiyatMessage({
      customerName: d.sale?.contact?.name || "",
      date: d.delivery_date,
      netWeight: d.net_weight,
      feedType: d.sale?.feed_type?.name,
      plate: d.vehicle_plate || undefined,
      driverName: d.driver_name,
      driverPhone: driverPhone,
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
    <div className="rounded-xl bg-card p-4 shadow-sm">
      {/* Top row: date + profit badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDateShort(d.delivery_date)}
          {d.sale?.feed_type?.name && (
            <span className="ml-2 text-foreground font-medium">{d.sale.feed_type.name}</span>
          )}
        </span>
        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {masked(customerAmount)}
        </span>
      </div>

      {/* Customer name */}
      <p className="text-base font-semibold mt-1.5">{d.sale?.contact?.name || "—"}</p>

      {/* Supplier (if available from purchase) */}
      {d.driver_name && (
        <p className="text-sm text-muted-foreground">Şoför: {d.driver_name}</p>
      )}

      {/* Middle row: plate + weight */}
      <div className="flex items-end justify-between mt-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Plaka No</p>
          {d.vehicle_plate ? (
            <span className="inline-block mt-0.5 rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-medium">
              {d.vehicle_plate}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Miktar</p>
          <div className="flex items-baseline gap-1 justify-end mt-0.5">
            <span className="text-2xl font-extrabold">{Math.round(d.net_weight).toLocaleString("tr-TR")}</span>
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
        </div>
      </div>

      {/* Bottom row: action icons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        {d.freight_cost != null && d.freight_cost > 0 && (
          <span className="text-xs text-muted-foreground mr-auto">
            Nakliye: {formatCurrency(d.freight_cost)}
            {d.freight_payer && d.freight_payer !== "customer" && (
              <span className="ml-1 text-[10px]">({FREIGHT_PAYER_LABELS[d.freight_payer]})</span>
            )}
          </span>
        )}
        {!d.freight_cost && <span className="mr-auto" />}
        {hasPhone && (
          <button
            onClick={handleWhatsApp}
            className={`p-2 rounded-lg transition-colors ${
              waSent ? "text-green-300 hover:bg-green-50" : "text-green-600 hover:bg-green-50"
            }`}
          >
            <MessageCircle className="h-4.5 w-4.5" />
          </button>
        )}
        <button onClick={onEdit} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <Pencil className="h-4.5 w-4.5" />
        </button>
        <button onClick={onDelete} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <Trash2 className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
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
          <div className="rounded-xl bg-card p-3 shadow-sm text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam Nakliye</p>
            <p className="text-sm font-bold mt-1">{masked(summary.totalFreight)}</p>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-sm text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ödenen</p>
            <p className="text-sm font-bold text-green-600 mt-1">{masked(summary.totalPaid)}</p>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-sm text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Kalan Borç</p>
            <p className="text-sm font-bold text-red-600 mt-1">{masked(summary.balance)}</p>
          </div>
        </div>
      )}

      {/* Carrier list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Nakliyeciler</h2>
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
                <div className="rounded-xl bg-card p-3 shadow-sm transition-colors hover:bg-muted/50">
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
                          b.balance > 0 ? "text-red-600" : b.balance < 0 ? "text-green-600" : ""
                        }`}
                      >
                        {masked(Math.abs(b.balance))}
                      </p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Nakliyeci bulunamadı</p>
            <p className="text-xs text-muted-foreground mt-1">Ayarlar sayfasından nakliyeci ekleyebilirsiniz.</p>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Son İşlemler</h2>
        {txsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recentTxs && recentTxs.length > 0 ? (
          <div className="space-y-1.5">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="rounded-xl bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {tx.type === "freight_charge" ? (
                      <Truck className="h-4 w-4 shrink-0 text-red-500" />
                    ) : (
                      <Banknote className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.carrier_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDateShort(tx.transaction_date)}
                        {tx.description && ` · ${tx.description}`}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-semibold text-sm shrink-0 ml-2 ${
                      tx.type === "freight_charge" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {tx.type === "freight_charge" ? "+" : "-"}
                    {masked(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Henüz işlem yok</p>
        )}
      </div>
    </>
  );
}
