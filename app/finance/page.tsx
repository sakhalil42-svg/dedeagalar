"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAccountSummaries } from "@/lib/hooks/use-account-transactions";
import type { AccountSummary, ContactType } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, Wallet, Plus, Phone, TrendingUp, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";

type TabType = "customers" | "suppliers" | "checks";
type BalanceFilter = "all" | "debtor" | "creditor" | "zero";
type SortOption = "name" | "balance_desc" | "balance_asc";

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

export default function FinancePage() {
  const [tab, setTab] = useState<TabType>("customers");
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [showFilters, setShowFilters] = useState(false);

  const { data: summaries, isLoading } = useAccountSummaries();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) =>
    isVisible ? formatCurrency(amount) : "••••••";

  const customers = useMemo(() => {
    if (!summaries) return [];
    return summaries.filter(
      (s) => s.contact_type === "customer" || s.contact_type === "both"
    );
  }, [summaries]);

  const suppliers = useMemo(() => {
    if (!summaries) return [];
    return summaries.filter(
      (s) => s.contact_type === "supplier" || s.contact_type === "both"
    );
  }, [summaries]);

  const list = tab === "customers" ? customers : suppliers;

  const filtered = useMemo(() => {
    if (!list) return [];
    let result = list;

    // Search
    if (search) {
      result = result.filter((s) =>
        s.contact_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Balance filter
    if (balanceFilter !== "all") {
      result = result.filter((s) => {
        const bal = s.balance ?? 0;
        if (balanceFilter === "debtor") return bal > 0;
        if (balanceFilter === "creditor") return bal < 0;
        if (balanceFilter === "zero") return bal === 0;
        return true;
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.contact_name.localeCompare(b.contact_name, "tr");
      const balA = Math.abs(a.balance ?? 0);
      const balB = Math.abs(b.balance ?? 0);
      return sortBy === "balance_desc" ? balB - balA : balA - balB;
    });

    return result;
  }, [list, search, balanceFilter, sortBy]);

  const totals = useMemo(() => {
    const isCustomerTab = tab === "customers";
    let mainTotal = 0;
    let paidTotal = 0;
    let net = 0;

    filtered.forEach((s) => {
      const bal = s.balance ?? 0;
      net += bal;
      if (isCustomerTab) {
        mainTotal += s.total_debit || Math.abs(bal);
        paidTotal += s.total_credit || 0;
      } else {
        mainTotal += s.total_credit || Math.abs(bal);
        paidTotal += s.total_debit || 0;
      }
    });

    return { mainTotal, paidTotal, net };
  }, [filtered, tab]);

  // Filter chips
  const chips: FilterChip[] = [];
  if (balanceFilter !== "all") {
    const bLabel = BALANCE_OPTIONS.find((o) => o.value === balanceFilter)?.label || "";
    chips.push({ key: "balance", label: "Bakiye", value: bLabel });
  }
  if (sortBy !== "name") {
    const sLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "";
    chips.push({ key: "sort", label: "Sıralama", value: sLabel });
  }

  const handleRemoveChip = (key: string) => {
    if (key === "balance") setBalanceFilter("all");
    if (key === "sort") setSortBy("name");
  };

  const handleClearAll = () => {
    setBalanceFilter("all");
    setSortBy("name");
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finans</h1>
          <p className="text-sm text-muted-foreground">
            Cari hesaplar ve bakiyeler
          </p>
        </div>
        <BalanceToggle />
      </div>

      {/* 3 Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {([
          { key: "customers", label: "Müşteriler" },
          { key: "suppliers", label: "Üreticiler" },
          { key: "checks", label: "Çek/Senet" },
        ] as { key: TabType; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === "checks") {
                window.location.href = "/finance/checks";
                return;
              }
              setTab(t.key);
              setSearch("");
            }}
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

      {/* Quick actions */}
      <div className="flex gap-2 overflow-x-auto">
        <Button size="sm" variant="outline" asChild>
          <Link href="/finance/payments">
            <Wallet className="mr-1 h-4 w-4" />
            Ödemeler
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/finance/calendar">
            Vade Takvimi
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/finance/profit">
            <TrendingUp className="mr-1 h-4 w-4" />
            Kar/Zarar
          </Link>
        </Button>
      </div>

      {/* Summary totals */}
      {!isLoading && filtered.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-2 p-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">
                {tab === "customers" ? "Toplam Alacak" : "Toplam Borç"}
              </p>
              <p className="font-bold text-red-600">
                {masked(Math.abs(totals.net))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Kişi Sayısı</p>
              <p className="font-bold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              tab === "customers" ? "Müşteri ara..." : "Üretici ara..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
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

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Link key={s.account_id} href={`/finance/${s.contact_id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.contact_name}</p>
                      <Badge
                        variant="secondary"
                        className="mt-1 text-xs"
                      >
                        {s.contact_type === "both"
                          ? "Üretici/Müşteri"
                          : s.contact_type === "customer"
                            ? "Müşteri"
                            : "Üretici"}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          s.balance > 0 ? "text-red-600" : s.balance < 0 ? "text-green-600" : ""
                        }`}
                      >
                        {masked(Math.abs(s.balance))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.balance > 0
                          ? (tab === "customers" ? "alacak" : "borç")
                          : s.balance < 0
                            ? "fazla ödeme"
                            : "denk"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search || balanceFilter !== "all"
            ? "Sonuç bulunamadı."
            : tab === "customers"
              ? "Henüz müşteri kaydı yok."
              : "Henüz üretici kaydı yok."}
        </div>
      )}
    </div>
  );
}
