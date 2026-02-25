"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSales } from "@/lib/hooks/use-sales";
import type { SaleStatus } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Loader2 } from "lucide-react";
import { formatCurrency, formatDateShort, formatWeight, formatPercent } from "@/lib/utils/format";

const STATUS_LABELS: Record<SaleStatus, string> = {
  draft: "Taslak",
  confirmed: "Onaylı",
  delivered: "Teslim",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<SaleStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const FILTER_OPTIONS: { label: string; value: SaleStatus | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Taslak", value: "draft" },
  { label: "Onaylı", value: "confirmed" },
  { label: "Teslim", value: "delivered" },
];

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "all">("all");
  const { data: sales, isLoading } = useSales();

  const filtered = useMemo(() => {
    if (!sales) return [];
    return sales.filter((s) => {
      const matchesSearch =
        !search ||
        s.sale_no?.toLowerCase().includes(search.toLowerCase()) ||
        s.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.feed_type?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sales, search, statusFilter]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Satışlar</h1>
          <p className="text-sm text-muted-foreground">Satış kayıtları</p>
        </div>
        <Button asChild size="sm">
          <Link href="/sales/new">
            <Plus className="mr-1 h-4 w-4" />
            Yeni
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="No, müşteri veya yem türü ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === opt.value
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
          {filtered.map((s) => {
            const deliveredQty = s.delivered_quantity || 0;
            const progress = s.quantity > 0 ? Math.min((deliveredQty / s.quantity) * 100, 100) : 0;

            return (
              <Link key={s.id} href={`/sales/${s.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">
                            {s.contact?.name || "—"}
                          </p>
                          <Badge
                            variant="secondary"
                            className={STATUS_COLORS[s.status]}
                          >
                            {STATUS_LABELS[s.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {s.feed_type?.name || "—"}
                        </p>
                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatWeight(deliveredQty)} / {formatWeight(s.quantity)}</span>
                            <span>{formatPercent(progress)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="font-semibold">
                          {formatCurrency(s.total_amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(s.sale_date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search || statusFilter !== "all"
            ? "Sonuç bulunamadı."
            : "Henüz satış kaydı yok."}
        </div>
      )}
    </div>
  );
}
