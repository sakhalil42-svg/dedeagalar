"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePayments } from "@/lib/hooks/use-payments";
import { useContacts } from "@/lib/hooks/use-contacts";
import type { PaymentDirection, PaymentMethod } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Banknote,
} from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";

const DIRECTION_LABELS: Record<PaymentDirection, string> = {
  inbound: "Tahsilat",
  outbound: "Ödeme",
};

const DIRECTION_COLORS: Record<PaymentDirection, string> = {
  inbound: "bg-green-100 text-green-800",
  outbound: "bg-red-100 text-red-800",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  bank_transfer: "Havale",
  check: "Çek",
  promissory_note: "Senet",
};

type DirectionFilter = PaymentDirection | "all";
type MethodFilter = PaymentMethod | "all";
type DateFilter = "all" | "today" | "week" | "month" | "custom";

const DIRECTION_OPTIONS: { label: string; value: DirectionFilter }[] = [
  { label: "Tümü", value: "all" },
  { label: "Ödeme", value: "outbound" },
  { label: "Tahsilat", value: "inbound" },
];

const METHOD_OPTIONS: { label: string; value: MethodFilter }[] = [
  { label: "Tümü", value: "all" },
  { label: "Nakit", value: "cash" },
  { label: "Havale", value: "bank_transfer" },
  { label: "Çek", value: "check" },
  { label: "Senet", value: "promissory_note" },
];

const DATE_OPTIONS: { label: string; value: DateFilter }[] = [
  { label: "Tümü", value: "all" },
  { label: "Bugün", value: "today" },
  { label: "Bu Hafta", value: "week" },
  { label: "Bu Ay", value: "month" },
  { label: "Özel", value: "custom" },
];

function isInRange(dateStr: string, range: DateFilter, startDate: string, endDate: string): boolean {
  if (range === "all") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);

  if (range === "custom") {
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      if (d < s) return false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      if (d > e) return false;
    }
    return true;
  }

  if (range === "today") return d.getTime() === today.getTime();
  if (range === "week") {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }
  if (range === "month") {
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return d >= monthAgo;
  }
  return true;
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [contactFilter, setContactFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: payments, isLoading } = usePayments();
  const { data: contacts } = useContacts();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";

  const filtered = useMemo(() => {
    if (!payments) return [];
    return payments.filter((p) => {
      const matchesSearch =
        !search ||
        p.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());
      const matchesDirection = directionFilter === "all" || p.direction === directionFilter;
      const matchesMethod = methodFilter === "all" || p.method === methodFilter;
      const matchesDate = isInRange(p.payment_date, dateFilter, startDate, endDate);
      const matchesContact = !contactFilter || p.contact_id === contactFilter;
      const matchesMin = !minAmount || p.amount >= parseFloat(minAmount);
      const matchesMax = !maxAmount || p.amount <= parseFloat(maxAmount);
      return matchesSearch && matchesDirection && matchesMethod && matchesDate && matchesContact && matchesMin && matchesMax;
    });
  }, [payments, search, directionFilter, methodFilter, dateFilter, contactFilter, startDate, endDate, minAmount, maxAmount]);

  const summary = useMemo(() => {
    const inbound = filtered.filter((p) => p.direction === "inbound");
    const outbound = filtered.filter((p) => p.direction === "outbound");
    return {
      inboundTotal: inbound.reduce((s, p) => s + (p.amount || 0), 0),
      inboundCount: inbound.length,
      outboundTotal: outbound.reduce((s, p) => s + (p.amount || 0), 0),
      outboundCount: outbound.length,
    };
  }, [filtered]);

  // Filter chips
  const chips: FilterChip[] = [];
  if (directionFilter !== "all") chips.push({ key: "direction", label: "Yön", value: DIRECTION_LABELS[directionFilter] });
  if (methodFilter !== "all") chips.push({ key: "method", label: "Yöntem", value: METHOD_LABELS[methodFilter] });
  if (dateFilter !== "all" && dateFilter !== "custom") {
    const dLabel = DATE_OPTIONS.find((o) => o.value === dateFilter)?.label || "";
    chips.push({ key: "date", label: "Tarih", value: dLabel });
  }
  if (dateFilter === "custom" && (startDate || endDate)) {
    chips.push({ key: "date", label: "Tarih", value: `${startDate || "..."} - ${endDate || "..."}` });
  }
  if (contactFilter) {
    const cName = contacts?.find((c) => c.id === contactFilter)?.name || "";
    chips.push({ key: "contact", label: "Kişi", value: cName });
  }
  if (minAmount || maxAmount) {
    chips.push({ key: "amount", label: "Tutar", value: `${minAmount || "0"} - ${maxAmount || "..."}` });
  }

  const handleRemoveChip = (key: string) => {
    if (key === "direction") setDirectionFilter("all");
    if (key === "method") setMethodFilter("all");
    if (key === "date") { setDateFilter("all"); setStartDate(""); setEndDate(""); }
    if (key === "contact") setContactFilter("");
    if (key === "amount") { setMinAmount(""); setMaxAmount(""); }
  };

  const handleClearAll = () => {
    setDirectionFilter("all");
    setMethodFilter("all");
    setDateFilter("all");
    setContactFilter("");
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
  };

  return (
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ödemeler</h1>
          <p className="text-sm text-muted-foreground">Ödeme ve tahsilat kayıtları</p>
        </div>
        <Button asChild size="sm">
          <Link href="/finance/payments/new">
            <Plus className="mr-1 h-4 w-4" />
            Yeni
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-green-200">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-green-700 font-medium">Tahsilat</p>
              <p className="text-sm font-bold text-green-600">{masked(summary.inboundTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.inboundCount} adet</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-red-700 font-medium">Ödeme</p>
              <p className="text-sm font-bold text-red-600">{masked(summary.outboundTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.outboundCount} adet</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Kişi veya açıklama ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Direction filter + toggle */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-2">
          {DIRECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDirectionFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                directionFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            showFilters ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Method + Date quick filters */}
      <div className="flex gap-4">
        <div className="flex gap-1.5 overflow-x-auto">
          {METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMethodFilter(opt.value)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                methodFilter === opt.value
                  ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                  : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                dateFilter === opt.value
                  ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                  : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {dateFilter === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Başlangıç</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bitiş</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      )}

      {/* Extended filters panel */}
      {showFilters && (
        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Kişi</p>
            <Select value={contactFilter || "all"} onValueChange={(v) => setContactFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Tüm kişiler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm kişiler</SelectItem>
                {(contacts || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Tutar Aralığı</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <FilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearAll} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      p.direction === "inbound"
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {p.direction === "inbound" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.contact?.name || "—"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="secondary"
                        className={DIRECTION_COLORS[p.direction]}
                      >
                        {DIRECTION_LABELS[p.direction]}
                      </Badge>
                      <span>{METHOD_LABELS[p.method]}</span>
                      <span>{formatDateShort(p.payment_date)}</span>
                    </div>
                    {p.description && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      p.direction === "inbound" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {masked(p.amount)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        search || directionFilter !== "all" || methodFilter !== "all" || dateFilter !== "all" || contactFilter || minAmount || maxAmount ? (
          <EmptyState
            icon={Search}
            title="Sonuç bulunamadı"
            description="Arama kriterlerini değiştirmeyi deneyin."
          />
        ) : (
          <EmptyState
            icon={Banknote}
            title="Henüz ödeme kaydı yok"
            description="Ödeme veya tahsilat kaydı ekleyin."
            actionLabel="Yeni Ödeme"
            actionHref="/finance/payments/new"
          />
        )
      )}
    </div>
  );
}
