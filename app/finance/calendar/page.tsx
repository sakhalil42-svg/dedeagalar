"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useChecks } from "@/lib/hooks/use-checks";
import { usePurchases } from "@/lib/hooks/use-purchases";
import { useSales } from "@/lib/hooks/use-sales";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, AlertTriangle, Clock, Calendar } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";

interface DueItem {
  id: string;
  type: "check" | "purchase" | "sale";
  label: string;
  contact_name: string;
  amount: number;
  due_date: string;
  status: string;
  link: string;
}

type TimeFilter = "week" | "month" | "all";

const FILTER_OPTIONS: { label: string; value: TimeFilter }[] = [
  { label: "Bu Hafta", value: "week" },
  { label: "Bu Ay", value: "month" },
  { label: "Tümü", value: "all" },
];

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueColor(days: number): string {
  if (days < 0) return "bg-red-100 text-red-800 border-red-200";
  if (days === 0) return "bg-orange-100 text-orange-800 border-orange-200";
  if (days <= 7) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (days <= 30) return "bg-green-100 text-green-800 border-green-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function getDueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} gün geçmiş`;
  if (days === 0) return "Bugün";
  if (days === 1) return "Yarın";
  return `${days} gün`;
}

function getLeftBorder(days: number): string {
  if (days < 0) return "border-l-4 border-l-red-500";
  if (days === 0) return "border-l-4 border-l-orange-500";
  if (days <= 7) return "border-l-4 border-l-yellow-500";
  if (days <= 30) return "border-l-4 border-l-green-500";
  return "border-l-4 border-l-gray-300";
}

export default function CalendarPage() {
  const [filter, setFilter] = useState<TimeFilter>("month");
  const { data: checks, isLoading: checksLoading } = useChecks();
  const { data: purchases, isLoading: purchasesLoading } = usePurchases();
  const { data: sales, isLoading: salesLoading } = useSales();

  const isLoading = checksLoading || purchasesLoading || salesLoading;
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";

  const dueItems = useMemo(() => {
    const items: DueItem[] = [];

    checks
      ?.filter((c) => c.status === "pending" || c.status === "deposited")
      .forEach((c) => {
        items.push({
          id: c.id,
          type: "check",
          label: c.check_type === "check" ? "Çek" : "Senet",
          contact_name: c.contact?.name || "—",
          amount: c.amount,
          due_date: c.due_date,
          status: c.status,
          link: "/finance/checks",
        });
      });

    purchases
      ?.filter((p) => p.due_date && p.status !== "cancelled")
      .forEach((p) => {
        items.push({
          id: p.id,
          type: "purchase",
          label: "Alım Ödeme",
          contact_name: p.contact?.name || "—",
          amount: p.total_amount,
          due_date: p.due_date!,
          status: p.status,
          link: `/purchases/${p.id}`,
        });
      });

    sales
      ?.filter((s) => s.due_date && s.status !== "cancelled")
      .forEach((s) => {
        items.push({
          id: s.id,
          type: "sale",
          label: "Satış Tahsilat",
          contact_name: s.contact?.name || "—",
          amount: s.total_amount,
          due_date: s.due_date!,
          status: s.status,
          link: `/sales/${s.id}`,
        });
      });

    items.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return items;
  }, [checks, purchases, sales]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueItems.filter((item) => {
      const due = new Date(item.due_date);
      due.setHours(0, 0, 0, 0);

      if (filter === "week") {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return due <= weekEnd;
      }
      if (filter === "month") {
        const monthEnd = new Date(today);
        monthEnd.setDate(monthEnd.getDate() + 30);
        return due <= monthEnd;
      }
      return true;
    });
  }, [dueItems, filter]);

  const overdue = filtered.filter((i) => getDaysUntil(i.due_date) < 0);
  const thisWeek = filtered.filter((i) => {
    const d = getDaysUntil(i.due_date);
    return d >= 0 && d <= 7;
  });
  const thisMonth = filtered.filter((i) => {
    const d = getDaysUntil(i.due_date);
    return d > 7 && d <= 30;
  });
  const future = filtered.filter((i) => getDaysUntil(i.due_date) > 30);

  // Totals
  const overdueTotal = overdue.reduce((s, i) => s + i.amount, 0);
  const weekTotal = thisWeek.reduce((s, i) => s + i.amount, 0);
  const monthTotal = thisMonth.reduce((s, i) => s + i.amount, 0);

  function renderItem(item: DueItem) {
    const days = getDaysUntil(item.due_date);
    const dueColor = getDueColor(days);
    const leftBorder = getLeftBorder(days);
    return (
      <Link key={`${item.type}-${item.id}`} href={item.link}>
        <div className={`flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 ${leftBorder}`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {item.label}
              </Badge>
              <Badge variant="secondary" className={`text-xs ${dueColor}`}>
                {getDueLabel(days)}
              </Badge>
            </div>
            <p className="text-sm font-medium">{item.contact_name}</p>
            <p className="text-xs text-muted-foreground">
              Vade: {formatDateShort(item.due_date)}
            </p>
          </div>
          <p className="text-sm font-bold">{masked(item.amount)}</p>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Vade Takvimi</h1>
          <p className="text-sm text-muted-foreground">Yaklaşan vadeler</p>
        </div>
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

      {/* Summary Cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-red-600 font-medium">Gecikmiş</p>
                <p className="text-sm font-bold text-red-600">{masked(overdueTotal)}</p>
                <p className="text-xs text-muted-foreground">{overdue.length} adet</p>
              </CardContent>
            </Card>
          )}
          <Card className="border-yellow-200">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-yellow-700 font-medium">Bu Hafta</p>
              <p className="text-sm font-bold text-yellow-700">{masked(weekTotal)}</p>
              <p className="text-xs text-muted-foreground">{thisWeek.length} adet</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-green-700 font-medium">Bu Ay</p>
              <p className="text-sm font-bold text-green-700">{masked(monthTotal)}</p>
              <p className="text-xs text-muted-foreground">{thisMonth.length} adet</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Overdue */}
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Vadesi Geçmiş ({overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdue.map(renderItem)}
              </CardContent>
            </Card>
          )}

          {/* This Week */}
          {thisWeek.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-yellow-700">
                  <Clock className="h-4 w-4" />
                  Bu Hafta ({thisWeek.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {thisWeek.map(renderItem)}
              </CardContent>
            </Card>
          )}

          {/* This Month */}
          {thisMonth.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Bu Ay ({thisMonth.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {thisMonth.map(renderItem)}
              </CardContent>
            </Card>
          )}

          {/* Future */}
          {future.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Gelecek ({future.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {future.map(renderItem)}
              </CardContent>
            </Card>
          )}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Yaklaşan vade yok.
            </div>
          )}
        </>
      )}
    </div>
  );
}
