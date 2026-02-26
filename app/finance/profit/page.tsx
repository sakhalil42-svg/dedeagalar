"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Truck,
} from "lucide-react";
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
  // all
  return { start: "2020-01-01", end: endStr };
}

function useProfitData(dateFilter: DateFilter) {
  const supabase = createClient();
  const { start, end } = getDateRange(dateFilter);

  return useQuery({
    queryKey: ["profit", dateFilter, start, end],
    queryFn: async () => {
      // 1. Total Sales (from account_transactions where reference_type = 'sale', type = 'debit')
      // Sales create a debit entry on customer account = revenue
      const { data: saleTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "sale")
        .eq("type", "debit")
        .gte("transaction_date", start)
        .lte("transaction_date", end);

      const totalSales = (saleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // 2. Total Purchases (from account_transactions where reference_type = 'purchase', type = 'credit')
      // Purchases create a credit entry on supplier account = cost
      const { data: purchaseTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "purchase")
        .eq("type", "credit")
        .gte("transaction_date", start)
        .lte("transaction_date", end);

      const totalPurchases = (purchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // 3. Freight costs from deliveries where freight_payer is company ('me' or null defaults)
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("freight_cost, freight_payer, net_weight")
        .gte("delivery_date", start)
        .lte("delivery_date", end);

      // Freight we pay ourselves (not customer or supplier)
      const totalFreight = (deliveries || []).reduce((s, d) => {
        const payer = d.freight_payer;
        // If payer is 'customer' or 'supplier', someone else pays → not our cost
        if (payer === "customer" || payer === "supplier") return s;
        return s + (d.freight_cost || 0);
      }, 0);

      // 4. Total tonnage
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
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Kar / Zarar</h1>
          <p className="text-sm text-muted-foreground">Gelir-gider analizi</p>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex gap-2">
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDateFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              dateFilter === opt.value
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
      ) : data ? (
        <>
          {/* Main Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Toplam Satış</p>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="mt-1 text-lg font-bold text-green-600">{masked(data.totalSales)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Toplam Alım</p>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
                <p className="mt-1 text-lg font-bold text-red-600">{masked(data.totalPurchases)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Nakliye Gideri</p>
                  <Truck className="h-4 w-4 text-orange-500" />
                </div>
                <p className="mt-1 text-lg font-bold text-orange-600">{masked(data.totalFreight)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Toplam Tonaj</p>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-lg font-bold">
                  {(data.totalTonnage / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton
                </p>
                <p className="text-xs text-muted-foreground">{data.deliveryCount} sevkiyat</p>
              </CardContent>
            </Card>
          </div>

          {/* Profit Summary */}
          <Card className={data.netProfit >= 0 ? "border-green-200" : "border-red-200"}>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Brüt Kar</p>
                  <p className={`text-xl font-bold ${data.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {masked(data.grossProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground">Satış - Alım</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Kar</p>
                  <p className={`text-xl font-bold ${data.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {masked(data.netProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground">Brüt Kar - Nakliye</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Margin info */}
          {data.totalSales > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Brüt Marj</p>
                    <p className="text-sm font-bold">
                      %{((data.grossProfit / data.totalSales) * 100).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net Marj</p>
                    <p className="text-sm font-bold">
                      %{((data.netProfit / data.totalSales) * 100).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ton Başı Kar</p>
                    <p className="text-sm font-bold">
                      {data.totalTonnage > 0
                        ? masked(data.netProfit / (data.totalTonnage / 1000))
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Monthly Profit Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aylık Kar/Zarar</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
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
                    borderRadius: 8,
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
        </CardContent>
      </Card>
    </div>
  );
}
