"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useChecks } from "@/lib/hooks/use-checks";
import { usePurchases } from "@/lib/hooks/use-purchases";
import { useSales } from "@/lib/hooks/use-sales";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertTriangle, Clock } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";

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

function getDueIndicator(days: number): {
  className: string;
  label: string;
} {
  if (days < 0) return { className: "bg-red-100 text-red-800", label: `${Math.abs(days)} gün geçmiş` };
  if (days === 0) return { className: "bg-red-100 text-red-800", label: "Bugün" };
  if (days <= 3) return { className: "bg-orange-100 text-orange-800", label: `${days} gün` };
  if (days <= 7) return { className: "bg-yellow-100 text-yellow-800", label: `${days} gün` };
  return { className: "bg-gray-100 text-gray-800", label: `${days} gün` };
}

export default function CalendarPage() {
  const [filter, setFilter] = useState<TimeFilter>("month");
  const { data: checks, isLoading: checksLoading } = useChecks();
  const { data: purchases, isLoading: purchasesLoading } = usePurchases();
  const { data: sales, isLoading: salesLoading } = useSales();

  const isLoading = checksLoading || purchasesLoading || salesLoading;

  const dueItems = useMemo(() => {
    const items: DueItem[] = [];

    // Checks with pending/deposited status
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

    // Purchases with due dates that are not cancelled
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

    // Sales with due dates that are not cancelled
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

    // Sort by due date
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
  const upcoming = filtered.filter((i) => getDaysUntil(i.due_date) >= 0);

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Overdue section */}
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Vadesi Geçmiş ({overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdue.map((item) => {
                  const days = getDaysUntil(item.due_date);
                  const indicator = getDueIndicator(days);
                  return (
                    <Link key={`${item.type}-${item.id}`} href={item.link}>
                      <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.label}
                            </Badge>
                            <Badge variant="secondary" className={`text-xs ${indicator.className}`}>
                              {indicator.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{item.contact_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Vade: {formatDateShort(item.due_date)}
                          </p>
                        </div>
                        <p className="text-sm font-bold">{formatCurrency(item.amount)}</p>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Upcoming section */}
          {upcoming.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  Yaklaşan Vadeler ({upcoming.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcoming.map((item) => {
                  const days = getDaysUntil(item.due_date);
                  const indicator = getDueIndicator(days);
                  return (
                    <Link key={`${item.type}-${item.id}`} href={item.link}>
                      <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.label}
                            </Badge>
                            <Badge variant="secondary" className={`text-xs ${indicator.className}`}>
                              {indicator.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{item.contact_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Vade: {formatDateShort(item.due_date)}
                          </p>
                        </div>
                        <p className="text-sm font-bold">{formatCurrency(item.amount)}</p>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ) : overdue.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Yaklaşan vade yok.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
