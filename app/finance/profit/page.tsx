"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Truck,
  Download,
  Scale,
} from "lucide-react";
import { generateProfitPdf } from "@/lib/utils/pdf-export";
import { formatCurrency } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DateFilter = "today" | "week" | "month" | "all";

const DATE_OPTIONS: { label: string; value: DateFilter }[] = [
  { label: "Bugün", value: "today" },
  { label: "Bu Hafta", value: "week" },
  { label: "Bu Ay", value: "month" },
  { label: "Tümü", value: "all" },
];

function getDateRange(filter: DateFilter): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const endStr = end.toISOString().split("T")[0];

  if (filter === "today") {
    return { start: today.toISOString().split("T")[0], end: endStr };
  }
  if (filter === "week") {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { start: weekAgo.toISOString().split("T")[0], end: endStr };
  }
  if (filter === "month") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: monthStart.toISOString().split("T")[0], end: endStr };
  }
  return { start: "2020-01-01", end: endStr };
}

function useProfitData(dateFilter: DateFilter) {
  const supabase = createClient();
  const { start, end } = getDateRange(dateFilter);

  return useQuery({
    queryKey: ["profit", dateFilter, start, end],
    queryFn: async () => {
      const { data: saleTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "sale")
        .eq("type", "debit")
        .gte("transaction_date", start)
        .lte("transaction_date", end);

      const totalSales = (saleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      const { data: purchaseTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "purchase")
        .eq("type", "credit")
        .gte("transaction_date", start)
        .lte("transaction_date", end);

      const totalPurchases = (purchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("freight_cost, freight_payer, net_weight")
        .gte("delivery_date", start)
        .lte("delivery_date", end);

      const totalFreight = (deliveries || []).reduce((s, d) => {
        const payer = d.freight_payer;
        if (payer === "customer" || payer === "supplier") return s;
        return s + (d.freight_cost || 0);
      }, 0);

      const totalTonnage = (deliveries || []).reduce((s, d) => s + (d.net_weight || 0), 0);

      const grossProfit = totalSales - totalPurchases;
      const netProfit = grossProfit - totalFreight;

      return {
        totalSales,
        totalPurchases,
        totalFreight,
        grossProfit,
        netProfit,
        totalTonnage,
        deliveryCount: (deliveries || []).length,
      };
    },
  });
}

function useMonthlyProfitChart() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["profit", "monthly_chart"],
    queryFn: async () => {
      const now = new Date();
      const months: { month: string; sales: number; purchases: number; profit: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
        const monthLabel = d.toLocaleDateString("tr-TR", { month: "short" });

        const { data: saleTxs } = await supabase
          .from("account_transactions")
          .select("amount")
          .eq("reference_type", "sale")
          .eq("type", "debit")
          .gte("transaction_date", start)
          .lte("transaction_date", end);

        const { data: purchaseTxs } = await supabase
          .from("account_transactions")
          .select("amount")
          .eq("reference_type", "purchase")
          .eq("type", "credit")
          .gte("transaction_date", start)
          .lte("transaction_date", end);

        const sales = (saleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);
        const purchases = (purchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

        months.push({
          month: monthLabel,
          sales,
          purchases,
          profit: sales - purchases,
        });
      }

      return months;
    },
  });
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export default function ProfitPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const { data, isLoading } = useProfitData(dateFilter);
  const { data: chartData, isLoading: chartLoading } = useMonthlyProfitChart();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";
  const tooltipFormatter = (value: number | undefined) => masked(value ?? 0);

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/finance"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Kar / Zarar</h1>
            <p className="text-xs text-muted-foreground">Gelir-gider analizi</p>
          </div>
        </div>
        {data && (
          <button
            onClick={() => {
              const label = DATE_OPTIONS.find((o) => o.value === dateFilter)?.label || "Tümü";
              generateProfitPdf({
                dateLabel: label,
                totalSales: data.totalSales,
                totalPurchases: data.totalPurchases,
                totalFreight: data.totalFreight,
                grossProfit: data.grossProfit,
                netProfit: data.netProfit,
                totalTonnage: data.totalTonnage,
                deliveryCount: data.deliveryCount,
              });
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Period Selector */}
      <div className="rounded-xl bg-card p-1 shadow-sm flex gap-1 mb-4">
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDateFilter(opt.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              dateFilter === opt.value
                ? "bg-primary text-white"
                : "text-muted-foreground"
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
      ) : data ? (
        <>
          {/* 2x2 KPI Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-green-600">{masked(data.totalSales)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Toplam Satış</p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-red-600">{masked(data.totalPurchases)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Toplam Alım</p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                  <Truck className="h-4 w-4 text-orange-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-orange-600">{masked(data.totalFreight)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Nakliye Gideri</p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                  <Scale className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold">
                {(data.totalTonnage / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{data.deliveryCount} Sevkiyat</p>
            </div>
          </div>

          {/* Net Profit Highlight Card */}
          <div className={`rounded-2xl p-5 shadow-sm mb-4 ${data.netProfit >= 0 ? "bg-primary text-white" : "bg-red-600 text-white"}`}>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs opacity-80 mb-1">Brüt Kar</p>
                <p className="text-2xl font-extrabold">{masked(data.grossProfit)}</p>
                <p className="text-[10px] opacity-60 mt-0.5">Satış - Alım</p>
              </div>
              <div>
                <p className="text-xs opacity-80 mb-1">Net Kar</p>
                <p className="text-2xl font-extrabold">{masked(data.netProfit)}</p>
                <p className="text-[10px] opacity-60 mt-0.5">Brüt Kar - Nakliye</p>
              </div>
            </div>
          </div>

          {/* Margin info */}
          {data.totalSales > 0 && (
            <div className="rounded-2xl bg-card p-4 shadow-sm mb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Brüt Marj</p>
                  <p className="text-lg font-extrabold">
                    %{((data.grossProfit / data.totalSales) * 100).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Net Marj</p>
                  <p className="text-lg font-extrabold">
                    %{((data.netProfit / data.totalSales) * 100).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ton Başı</p>
                  <p className="text-lg font-extrabold">
                    {data.totalTonnage > 0
                      ? masked(data.netProfit / (data.totalTonnage / 1000))
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Monthly Profit Chart */}
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Aylık Kar/Zarar</span>
        </div>
        {chartLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : chartData && chartData.some((d) => d.sales > 0 || d.purchases > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompact} />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sales" name="Satış" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name="Alım" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Kar" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Grafik verisi yok.
          </div>
        )}
      </div>
    </div>
  );
}
