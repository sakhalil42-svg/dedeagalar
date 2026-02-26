"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePurchases } from "@/lib/hooks/use-purchases";
import type { PurchaseStatus } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, ShoppingCart } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: "Beklemede",
  draft: "Taslak",
  confirmed: "Onaylı",
  delivered: "Teslim",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  pending: "bg-gray-100 text-gray-800",
  draft: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const PRICING_LABELS: Record<string, string> = {
  nakliye_dahil: "Nakliye Dahil",
  tir_ustu: "Tır Üstü",
};

const FILTER_OPTIONS: { label: string; value: PurchaseStatus | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Taslak", value: "draft" },
  { label: "Onaylı", value: "confirmed" },
  { label: "Teslim", value: "delivered" },
];

export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "all">("all");
  const { data: purchases, isLoading } = usePurchases();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";

  const filtered = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter((p) => {
      const matchesSearch =
        !search ||
        p.purchase_no?.toLowerCase().includes(search.toLowerCase()) ||
        p.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.feed_type?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchases, search, statusFilter]);

  return (
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alımlar</h1>
          <p className="text-sm text-muted-foreground">Alım kayıtları</p>
        </div>
        <Button asChild size="sm">
          <Link href="/purchases/new">
            <Plus className="mr-1 h-4 w-4" />
            Yeni
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="No, üretici veya yem türü ara..."
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
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link key={p.id} href={`/purchases/${p.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {p.purchase_no}
                        </span>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[p.status]}
                        >
                          {STATUS_LABELS[p.status]}
                        </Badge>
                        {p.pricing_model && (
                          <Badge variant="outline" className="text-xs">
                            {PRICING_LABELS[p.pricing_model] || p.pricing_model}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">
                        {p.contact?.name || "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {p.feed_type?.name || "—"} · {p.quantity} {p.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {masked(p.total_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(p.purchase_date)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        search || statusFilter !== "all" ? (
          <EmptyState
            icon={Search}
            title="Sonuç bulunamadı"
            description="Arama kriterlerini değiştirmeyi deneyin."
          />
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="Henüz alım kaydı yok"
            description="Üreticilerden alım kaydı ekleyin."
            actionLabel="Yeni Alım"
            actionHref="/purchases/new"
          />
        )
      )}
    </div>
  );
}
