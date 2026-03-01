"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParcels, useCreateParcel } from "@/lib/hooks/use-parcels";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useRegionProfitability } from "@/lib/hooks/use-parcel-profitability";
import { useSeasonFilter } from "@/lib/contexts/season-context";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { formatCurrency } from "@/lib/utils/format";
import type {
  ParcelStatus,
  ParcelPaymentType,
  BalingProvider,
  CropType,
  ParcelInsert,
} from "@/lib/types/database.types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonRow } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Plus,
  Search,
  MapPin,
  Wheat,
  Package,
  ChevronRight,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── CONSTANTS ───────────────────────────────────────────────

const STATUS_LABELS: Record<ParcelStatus, string> = {
  active: "Aktif",
  baling: "Balyalanıyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<ParcelStatus, string> = {
  active: "bg-blue-100 text-blue-800",
  baling: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const CROP_LABELS: Record<CropType, string> = {
  bugday_sapi: "Buğday Sapı",
  arpa_sapi: "Arpa Sapı",
};

const PAYMENT_LABELS: Record<ParcelPaymentType, string> = {
  per_dekar: "Dekara göre",
  per_bale: "Balyaya göre",
};

type StatusFilter = ParcelStatus | "all";
type CropFilter = CropType | "all";

// ─── MAIN PAGE ───────────────────────────────────────────────

export default function ParcelsPage() {
  const [tab, setTab] = useState<"parcels" | "regions">("parcels");

  return (
    <div className="pb-24">
      {/* Tab selector */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="flex px-4 gap-1 py-2">
          <button
            onClick={() => setTab("parcels")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${
              tab === "parcels"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Tarlalar
          </button>
          <button
            onClick={() => setTab("regions")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${
              tab === "regions"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Bolge Ozeti
          </button>
        </div>
      </div>

      {tab === "parcels" ? <ParcelsTab /> : <RegionsTab />}
    </div>
  );
}

// ─── PARCELS TAB ─────────────────────────────────────────────

function ParcelsTab() {
  const { selectedSeasonId } = useSeasonFilter();
  const { data: parcels, isLoading } = useParcels(selectedSeasonId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cropFilter, setCropFilter] = useState<CropFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get unique regions for filter
  const regions = useMemo(() => {
    if (!parcels) return [];
    const set = new Set(parcels.map((p) => p.region).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [parcels]);

  const filtered = useMemo(() => {
    if (!parcels) return [];
    let list = parcels;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.parcel_name.toLowerCase().includes(q) ||
          p.contact?.name?.toLowerCase().includes(q) ||
          p.village?.toLowerCase().includes(q) ||
          p.region?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (cropFilter !== "all") {
      list = list.filter((p) => p.crop_type === cropFilter);
    }
    if (regionFilter !== "all") {
      list = list.filter((p) => p.region === regionFilter);
    }

    return list;
  }, [parcels, search, statusFilter, cropFilter, regionFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const active = (parcels || []).filter((p) => p.status !== "cancelled");
    return {
      total: active.length,
      totalBales: active.reduce((s, p) => s + p.total_bales, 0),
      remainingBales: active.reduce((s, p) => s + p.remaining_bales, 0),
      shippedBales: active.reduce((s, p) => s + p.shipped_bales, 0),
    };
  }, [parcels]);

  return (
    <div className="px-4 pt-3 space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-blue-50 p-2.5 text-center">
          <div className="text-lg font-bold text-blue-700">{stats.total}</div>
          <div className="text-[10px] text-blue-600 font-medium">Parsel</div>
        </div>
        <div className="rounded-xl bg-green-50 p-2.5 text-center">
          <div className="text-lg font-bold text-green-700">{stats.totalBales.toLocaleString("tr-TR")}</div>
          <div className="text-[10px] text-green-600 font-medium">Toplam Balya</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-2.5 text-center">
          <div className="text-lg font-bold text-amber-700">{stats.remainingBales.toLocaleString("tr-TR")}</div>
          <div className="text-[10px] text-amber-600 font-medium">Kalan Balya</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Parsel, sahip, koy ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-muted border-0"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-auto min-w-[100px] h-8 rounded-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Durum</SelectItem>
            {(Object.entries(STATUS_LABELS) as [ParcelStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cropFilter} onValueChange={(v) => setCropFilter(v as CropFilter)}>
          <SelectTrigger className="w-auto min-w-[100px] h-8 rounded-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Urun</SelectItem>
            {(Object.entries(CROP_LABELS) as [CropType, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {regions.length > 0 && (
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-auto min-w-[100px] h-8 rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Bolge</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Parcel list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="Parsel bulunamadi"
          description={search ? "Arama kriterlerini degistirin" : "Yeni parsel ekleyin"}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link key={p.id} href={`/parcels/${p.id}`}>
              <div className="rounded-xl border bg-card p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{p.parcel_name}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1.5">
                      {p.contact?.name || "—"}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {(p.village || p.city || p.region) && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {[p.village, p.district, p.city].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {CROP_LABELS[p.crop_type]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-green-700">{p.shipped_bales}</span>
                      <span className="text-muted-foreground">/</span>
                      <span>{p.total_bales}</span>
                    </div>
                    {p.remaining_bales > 0 && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        {p.remaining_bales} kaldi
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                </div>
                {/* Progress bar */}
                {p.total_bales > 0 && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (p.shipped_bales / p.total_bales) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* FAB - New Parcel */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <button className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">
            <Plus className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Parsel</DialogTitle>
          </DialogHeader>
          <NewParcelForm onSuccess={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── NEW PARCEL FORM ─────────────────────────────────────────

function NewParcelForm({ onSuccess }: { onSuccess: () => void }) {
  const { selectedSeasonId } = useSeasonFilter();
  const { data: contacts } = useContacts();
  const { data: feedTypes } = useFeedTypes();
  const createParcel = useCreateParcel();

  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [village, setVillage] = useState("");
  const [region, setRegion] = useState("");
  const [cropType, setCropType] = useState<CropType>("bugday_sapi");
  const [feedTypeId, setFeedTypeId] = useState("");
  const [areaDekar, setAreaDekar] = useState("");

  const [paymentType, setPaymentType] = useState<ParcelPaymentType>("per_bale");
  const [pricePerDekar, setPricePerDekar] = useState("");
  const [pricePerBale, setPricePerBale] = useState("");

  const [balingProvider, setBalingProvider] = useState<BalingProvider>("own");
  const [contractorId, setContractorId] = useState("");
  const [contractorCostPerBale, setContractorCostPerBale] = useState("");
  const [balingDate, setBalingDate] = useState("");

  const [totalBales, setTotalBales] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Parsel adi giriniz");
      return;
    }
    if (!contactId) {
      toast.error("Tarla sahibini seciniz");
      return;
    }

    const input: ParcelInsert = {
      parcel_name: name.trim(),
      contact_id: contactId,
      city: city.trim() || null,
      district: district.trim() || null,
      village: village.trim() || null,
      region: region.trim() || null,
      crop_type: cropType,
      feed_type_id: feedTypeId || null,
      area_dekar: areaDekar ? parseFloat(areaDekar) : null,
      payment_type: paymentType,
      price_per_dekar: pricePerDekar ? parseFloat(pricePerDekar) : null,
      price_per_bale: pricePerBale ? parseFloat(pricePerBale) : null,
      baling_provider: balingProvider,
      contractor_id: balingProvider === "contractor" && contractorId ? contractorId : null,
      contractor_cost_per_bale: contractorCostPerBale ? parseFloat(contractorCostPerBale) : null,
      baling_date: balingDate || null,
      total_bales: totalBales ? parseInt(totalBales, 10) : 0,
      storage_location: storageLocation.trim() || null,
      notes: notes.trim() || null,
      season_id: selectedSeasonId || null,
    };

    try {
      await createParcel.mutateAsync(input);
      toast.success("Parsel eklendi");
      onSuccess();
    } catch (err) {
      toast.error("Hata: " + (err instanceof Error ? err.message : "Bilinmeyen"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Temel bilgiler */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temel Bilgiler</h3>
        <Input placeholder="Parsel adi *" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />

        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Tarla sahibi *" /></SelectTrigger>
          <SelectContent>
            {(contacts || []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cropType} onValueChange={(v) => setCropType(v as CropType)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bugday_sapi">Bugday Sapi</SelectItem>
            <SelectItem value="arpa_sapi">Arpa Sapi</SelectItem>
          </SelectContent>
        </Select>

        <Select value={feedTypeId} onValueChange={setFeedTypeId}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Yem turu (opsiyonel)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Secilmedi</SelectItem>
            {(feedTypes || []).filter(f => f.is_active).map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lokasyon */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lokasyon</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Il" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl" />
          <Input placeholder="Ilce" value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Koy" value={village} onChange={(e) => setVillage(e.target.value)} className="rounded-xl" />
          <Input placeholder="Bolge" value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl" />
        </div>
        <Input placeholder="Alan (dekar)" type="number" value={areaDekar} onChange={(e) => setAreaDekar(e.target.value)} className="rounded-xl" />
      </div>

      {/* Odeme */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tarla Sahibine Odeme</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPaymentType("per_bale")}
            className={`py-2 text-sm font-medium rounded-xl border transition-colors ${
              paymentType === "per_bale" ? "bg-primary text-primary-foreground border-primary" : "border-border"
            }`}
          >
            Balyaya Gore
          </button>
          <button
            onClick={() => setPaymentType("per_dekar")}
            className={`py-2 text-sm font-medium rounded-xl border transition-colors ${
              paymentType === "per_dekar" ? "bg-primary text-primary-foreground border-primary" : "border-border"
            }`}
          >
            Dekara Gore
          </button>
        </div>
        {paymentType === "per_bale" ? (
          <Input placeholder="Balya basi fiyat (TL)" type="number" value={pricePerBale} onChange={(e) => setPricePerBale(e.target.value)} className="rounded-xl" />
        ) : (
          <Input placeholder="Dekar basi fiyat (TL)" type="number" value={pricePerDekar} onChange={(e) => setPricePerDekar(e.target.value)} className="rounded-xl" />
        )}
      </div>

      {/* Balyalama */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balyalama</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setBalingProvider("own")}
            className={`py-2 text-sm font-medium rounded-xl border transition-colors ${
              balingProvider === "own" ? "bg-primary text-primary-foreground border-primary" : "border-border"
            }`}
          >
            Kendi Makinemiz
          </button>
          <button
            onClick={() => setBalingProvider("contractor")}
            className={`py-2 text-sm font-medium rounded-xl border transition-colors ${
              balingProvider === "contractor" ? "bg-primary text-primary-foreground border-primary" : "border-border"
            }`}
          >
            Muteahhit
          </button>
        </div>

        {balingProvider === "contractor" && (
          <>
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Muteahhit sec" /></SelectTrigger>
              <SelectContent>
                {(contacts || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Balya basi muteahhit ucreti (TL)" type="number" value={contractorCostPerBale} onChange={(e) => setContractorCostPerBale(e.target.value)} className="rounded-xl" />
          </>
        )}

        <Input type="date" value={balingDate} onChange={(e) => setBalingDate(e.target.value)} className="rounded-xl" />
        <Input placeholder="Toplam balya sayisi" type="number" value={totalBales} onChange={(e) => setTotalBales(e.target.value)} className="rounded-xl" />
      </div>

      {/* Depolama */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Diger</h3>
        <Input placeholder="Depolama yeri" value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className="rounded-xl" />
        <Input placeholder="Notlar" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={createParcel.isPending}
        className="w-full h-12 rounded-xl text-base font-semibold"
      >
        {createParcel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Parsel Ekle
      </Button>
    </div>
  );
}

// ─── REGIONS TAB ─────────────────────────────────────────────

function RegionsTab() {
  const { selectedSeasonId } = useSeasonFilter();
  const { data: regions, isLoading } = useRegionProfitability(selectedSeasonId);
  const { isVisible } = useBalanceVisibility();
  const isHidden = !isVisible;

  if (isLoading) {
    return <div className="px-4 pt-3 space-y-3">{[1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>;
  }

  if (!regions || regions.length === 0) {
    return (
      <div className="px-4 pt-3">
        <EmptyState
          icon={TrendingUp}
          title="Bolge verisi yok"
          description="Parsel ekleyip sevkiyat yaptiktan sonra bolge ozeti burada gorunecek"
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 space-y-3">
      {regions.map((r) => (
        <div key={r.region} className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{r.region}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {r.parcel_count} parsel
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Toplam Balya:</span>
              <span className="ml-1 font-medium">{Number(r.total_bales).toLocaleString("tr-TR")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ort. Balya Kg:</span>
              <span className="ml-1 font-medium">{Number(r.avg_bale_weight).toLocaleString("tr-TR")} kg</span>
            </div>
            <div>
              <span className="text-muted-foreground">Gelir:</span>
              <span className="ml-1 font-medium">{isHidden ? "***" : formatCurrency(Number(r.total_revenue))}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Kar:</span>
              <span className={`ml-1 font-semibold ${Number(r.total_profit) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {isHidden ? "***" : formatCurrency(Number(r.total_profit))}
              </span>
            </div>
          </div>

          {Number(r.total_revenue) > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${Number(r.profit_margin_pct) >= 0 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, Math.max(0, Number(r.profit_margin_pct)))}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                %{Number(r.profit_margin_pct).toFixed(1)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
