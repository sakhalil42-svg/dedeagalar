"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useAccountSummaries } from "@/lib/hooks/use-account-transactions";
import type { ContactType } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Phone, MapPin, MessageCircle, SlidersHorizontal, Users } from "lucide-react";
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
  supplier: "bg-blue-100 text-blue-800",
  customer: "bg-green-100 text-green-800",
  both: "bg-purple-100 text-purple-800",
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

  // Build balance map
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (summaries) {
      summaries.forEach((s) => {
        map.set(s.contact_id, s.balance ?? 0);
      });
    }
    return map;
  }, [summaries]);

  const filtered = useMemo(() => {
    if (!contacts) return [];

    let list = contacts.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    // Balance filter
    if (balanceFilter !== "all") {
      list = list.filter((c) => {
        const bal = balanceMap.get(c.id) || 0;
        if (balanceFilter === "debtor") return bal > 0;
        if (balanceFilter === "creditor") return bal < 0;
        if (balanceFilter === "zero") return bal === 0;
        return true;
      });
    }

    // Sort
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
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kişiler</h1>
          <p className="text-sm text-muted-foreground">
            Üretici ve müşteri kayıtları
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/contacts/new">
            <Plus className="mr-1 h-4 w-4" />
            Yeni
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="İsim ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type filter + toggle */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                typeFilter === opt.value
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

      {/* Extended filters */}
      {showFilters && (
        <div className="space-y-2 rounded-lg border p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Bakiye Durumu</p>
            <div className="flex gap-1.5 flex-wrap">
              {BALANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBalanceFilter(opt.value)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    balanceFilter === opt.value
                      ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {opt.label}
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((contact) => {
            const balance = balanceMap.get(contact.id) || 0;
            return (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{contact.name}</p>
                        {contact.phone && (
                          <p className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </p>
                        )}
                        {contact.city && (
                          <p className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {contact.city}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {balance !== 0 && (
                          <span className={`text-xs font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                            {formatCurrency(Math.abs(balance))}
                          </span>
                        )}
                        {contact.phone && (
                          <>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(`tel:${contact.phone}`, "_self");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const wp = formatPhoneForWhatsApp(contact.phone);
                                if (wp) window.open(`https://wa.me/${wp}`, "_blank");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <Badge
                          variant="secondary"
                          className={TYPE_COLORS[contact.type]}
                        >
                          {TYPE_LABELS[contact.type]}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
