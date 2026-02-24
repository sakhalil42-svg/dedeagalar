"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAccountSummaries } from "@/lib/hooks/use-account-transactions";
import type { ContactType } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, Wallet, FileText, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

const TYPE_LABELS: Record<ContactType, string> = {
  supplier: "Üretici",
  customer: "Müşteri",
  both: "Üretici/Müşteri",
};

const FILTER_OPTIONS: { label: string; value: ContactType | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Üretici", value: "supplier" },
  { label: "Müşteri", value: "customer" },
];

export default function FinancePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactType | "all">("all");
  const { data: summaries, isLoading } = useAccountSummaries();

  const filtered = useMemo(() => {
    if (!summaries) return [];
    return summaries.filter((s) => {
      const matchesSearch =
        !search || s.contact_name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" || s.contact_type === filter || s.contact_type === "both";
      return matchesSearch && matchesFilter;
    });
  }, [summaries, search, filter]);

  const totals = useMemo(() => {
    if (!filtered) return { debit: 0, credit: 0, net: 0 };
    return filtered.reduce(
      (acc, s) => ({
        debit: acc.debit + s.total_debit,
        credit: acc.credit + s.total_credit,
        net: acc.net + s.balance,
      }),
      { debit: 0, credit: 0, net: 0 }
    );
  }, [filtered]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Cari Hesaplar</h1>
        <p className="text-sm text-muted-foreground">
          Hesap bakiyeleri ve hareketler
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-2">
        <Link href="/finance/payments">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="p-3 text-center">
              <Wallet className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-xs font-medium">Ödemeler</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/finance/checks">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="p-3 text-center">
              <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-xs font-medium">Çek/Senet</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/finance/calendar">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="p-3 text-center">
              <CalendarDays className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-xs font-medium">Vade Takvimi</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Summary totals */}
      {!isLoading && filtered.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-3 gap-2 p-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">Toplam Borç</p>
              <p className="font-bold text-red-600">{formatCurrency(totals.debit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Toplam Alacak</p>
              <p className="font-bold text-green-600">{formatCurrency(totals.credit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Net Bakiye</p>
              <p className={`font-bold ${totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totals.net)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Kişi ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Account list */}
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
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {TYPE_LABELS[s.contact_type]}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          s.balance >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(s.balance)}
                      </p>
                      <p className="text-xs text-muted-foreground">bakiye</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search ? "Sonuç bulunamadı." : "Henüz cari hesap kaydı yok."}
        </div>
      )}
    </div>
  );
}
