"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePayments } from "@/lib/hooks/use-payments";
import type { PaymentDirection, PaymentMethod } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";

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

const FILTER_OPTIONS: { label: string; value: PaymentDirection | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Ödeme", value: "outbound" },
  { label: "Tahsilat", value: "inbound" },
];

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PaymentDirection | "all">("all");
  const { data: payments, isLoading } = usePayments();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";

  const filtered = useMemo(() => {
    if (!payments) return [];
    return payments.filter((p) => {
      const matchesSearch =
        !search ||
        p.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || p.direction === filter;
      return matchesSearch && matchesFilter;
    });
  }, [payments, search, filter]);

  return (
    <div className="space-y-4 p-4">
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Kişi veya açıklama ara..."
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search || filter !== "all"
            ? "Sonuç bulunamadı."
            : "Henüz ödeme kaydı yok."}
        </div>
      )}
    </div>
  );
}
