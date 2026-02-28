"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useAccountSummaries } from "@/lib/hooks/use-account-transactions";
import type { ContactType } from "@/lib/types/database.types";
import { Plus, Search, Phone, MapPin, MessageCircle, SlidersHorizontal, Users, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { SkeletonRow } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPhoneForWhatsApp } from "@/lib/utils/whatsapp";
import { formatCurrency } from "@/lib/utils/format";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";

const TYPE_LABELS: Record<ContactType, string> = {
  supplier: "Üretici",
  customer: "Müşteri",
  both: "Üretici/Müşteri",
};

const TYPE_COLORS: Record<ContactType, string> = {
  supplier: "bg-blue-100 text-blue-700",
  customer: "bg-emerald-100 text-emerald-700",
  both: "bg-purple-100 text-purple-700",
};

const AVATAR_COLORS: Record<ContactType, string> = {
  supplier: "bg-blue-500",
  customer: "bg-emerald-500",
  both: "bg-purple-500",
};

type TypeFilter = ContactType | "all";
type BalanceFilter = "all" | "debtor" | "creditor" | "zero";
type SortOption = "name" | "balance_desc" | "balance_asc";

const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
  { label: "Tümü", value: "all" },
  { label: "Üretici", value: "supplier" },
  { label: "Müşteri", value: "customer" },
];

const BALANCE_OPTIONS: { label: string; value: BalanceFilter }[] = [
  { label: "Tümü", value: "all" },
  { label: "Borçlu", value: "debtor" },
  { label: "Alacaklı", value: "creditor" },
  { label: "Denk", value: "zero" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "A-Z", value: "name" },
  { label: "Bakiye ↓", value: "balance_desc" },
  { label: "Bakiye ↑", value: "balance_asc" },
];

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [showFilters, setShowFilters] = useState(false);

  const { data: contacts, isLoading } = useContacts(
    typeFilter === "all" ? undefined : typeFilter
  );
  const { data: summaries } = useAccountSummaries();

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (summaries) {
      summaries.forEach((s) => {
        map.set(s.contact_id, s.balance ?? 0);
      });
    }
    return map;
  }, [summaries]);

  // Summary stats
  const stats = useMemo(() => {
    if (!contacts) return { total: 0, suppliers: 0, customers: 0, totalDebt: 0, totalCredit: 0 };
    const suppliers = contacts.filter(c => c.type === "supplier" || c.type === "both").length;
    const customers = contacts.filter(c => c.type === "customer" || c.type === "both").length;
    let totalDebt = 0;
    let totalCredit = 0;
    contacts.forEach(c => {
      const bal = balanceMap.get(c.id) || 0;
      if (bal > 0) totalDebt += bal;
      else if (bal < 0) totalCredit += Math.abs(bal);
    });
    return { total: contacts.length, suppliers, customers, totalDebt, totalCredit };
  }, [contacts, balanceMap]);

  const filtered = useMemo(() => {
    if (!contacts) return [];

    let list = contacts.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    if (balanceFilter !== "all") {
      list = list.filter((c) => {
        const bal = balanceMap.get(c.id) || 0;
        if (balanceFilter === "debtor") return bal > 0;
        if (balanceFilter === "creditor") return bal < 0;
        if (balanceFilter === "zero") return bal === 0;
        return true;
      });
    }

    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "tr");
      const balA = Math.abs(balanceMap.get(a.id) || 0);
      const balB = Math.abs(balanceMap.get(b.id) || 0);
      return sortBy === "balance_desc" ? balB - balA : balA - balB;
    });

    return list;
  }, [contacts, search, balanceFilter, sortBy, balanceMap]);

  // Filter chips
  const chips: FilterChip[] = [];
  if (typeFilter !== "all") chips.push({ key: "type", label: "Tür", value: TYPE_LABELS[typeFilter] });
  if (balanceFilter !== "all") {
    const bLabel = BALANCE_OPTIONS.find((o) => o.value === balanceFilter)?.label || "";
    chips.push({ key: "balance", label: "Bakiye", value: bLabel });
  }
  if (sortBy !== "name") {
    const sLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "";
    chips.push({ key: "sort", label: "Sıralama", value: sLabel });
  }

  const handleRemoveChip = (key: string) => {
    if (key === "type") setTypeFilter("all");
    if (key === "balance") setBalanceFilter("all");
    if (key === "sort") setSortBy("name");
  };

  const handleClearAll = () => {
    setTypeFilter("all");
    setBalanceFilter("all");
    setSortBy("name");
  };

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Kişiler</h1>
          <p className="text-xs text-muted-foreground">
            {stats.total} kişi kayıtlı
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Yeni Kişi
        </Link>
      </div>

      {/* Summary Cards */}
      {!isLoading && stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl bg-card p-3 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-lg font-extrabold">{stats.total}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam</p>
          </div>
          <div className="rounded-2xl bg-card p-3 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
            </div>
            <p className="text-lg font-extrabold text-red-600">{formatCurrency(stats.totalDebt)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Alacak</p>
          </div>
          <div className="rounded-2xl bg-card p-3 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />
            </div>
            <p className="text-lg font-extrabold text-green-600">{formatCurrency(stats.totalCredit)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Borç</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="İsim ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl bg-muted px-4 py-3 pl-10 text-sm outline-none ring-0 focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Type filter + toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex flex-1 gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                typeFilter === opt.value
                  ? "bg-primary text-white"
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
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            showFilters ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="rounded-xl bg-card p-3 shadow-sm mb-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1.5">Bakiye Durumu</p>
            <div className="flex gap-1.5 flex-wrap">
              {BALANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBalanceFilter(opt.value)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    balanceFilter === opt.value
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1.5">Sıralama</p>
            <div className="flex gap-1.5 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortBy === opt.value
                      ? "bg-primary text-white"
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

      {isLoading ? (
        <div className="space-y-2 mt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2 mt-3">
          {filtered.map((contact) => {
            const balance = balanceMap.get(contact.id) || 0;
            const creditLimit = contact.credit_limit;
            const hasLimit = creditLimit != null && creditLimit > 0;
            const limitRatio = hasLimit ? (balance / creditLimit) * 100 : 0;
            const limitBarColor = limitRatio >= 100 ? "bg-red-500" : limitRatio >= 80 ? "bg-yellow-500" : "bg-green-500";
            return (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <div className="rounded-xl bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold ${AVATAR_COLORS[contact.type]}`}>
                      {getInitials(contact.name)}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{contact.name}</p>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${TYPE_COLORS[contact.type]}`}>
                          {TYPE_LABELS[contact.type]}
                        </span>
                        {hasLimit && balance > 0 && limitRatio >= 100 && (
                          <span className="rounded-full bg-red-100 text-red-700 text-[9px] font-semibold px-1.5 py-0.5 shrink-0">
                            LİMİT AŞIMI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {contact.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </span>
                        )}
                        {contact.city && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {contact.city}
                          </span>
                        )}
                      </div>
                      {hasLimit && balance > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="h-1.5 flex-1 rounded-full bg-muted max-w-[120px]">
                            <div className={`h-full rounded-full transition-all ${limitBarColor}`} style={{ width: `${Math.min(limitRatio, 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            %{Math.min(limitRatio, 999).toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: balance + actions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {balance !== 0 && (
                        <span className={`text-sm font-extrabold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(Math.abs(balance))}
                        </span>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open(`tel:${contact.phone}`, "_self");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                          >
                            <Phone className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const wp = formatPhoneForWhatsApp(contact.phone);
                              if (wp) window.open(`https://wa.me/${wp}`, "_blank");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        search || typeFilter !== "all" || balanceFilter !== "all" ? (
          <EmptyState
            icon={Search}
            title="Sonuç bulunamadı"
            description="Arama kriterlerini değiştirmeyi deneyin."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Henüz kişi kaydı yok"
            description="Üretici veya müşteri ekleyerek başlayın."
            actionLabel="Yeni Kişi Ekle"
            actionHref="/contacts/new"
          />
        )
      )}
    </div>
  );
}
