"use client";

import Link from "next/link";
import {
  useDashboardKpis,
  useMonthlyChart,
  useRecentTransactions,
  useDueItems,
} from "@/lib/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  TrendingUp,
  Package,
  Wallet,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
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

function KpiCard({
  title,
  value,
  icon: Icon,
  loading,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading?: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? (
          <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className={`mt-1 text-lg font-bold ${color || ""}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

const tooltipFormatter = (value: number | undefined) => formatCurrency(value ?? 0);

export function DashboardContent() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: chartData, isLoading: chartLoading } = useMonthlyChart();
  const { data: recent, isLoading: recentLoading } = useRecentTransactions();
  const { data: dueItems, isLoading: dueLoading } = useDueItems();

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          title="Alım (Bu Ay)"
          value={kpis ? formatCurrency(kpis.totalPurchases) : "--"}
          icon={ShoppingCart}
          loading={kpisLoading}
        />
        <KpiCard
          title="Satış (Bu Ay)"
          value={kpis ? formatCurrency(kpis.totalSales) : "--"}
          icon={TrendingUp}
          loading={kpisLoading}
        />
        <KpiCard
          title="Stok"
          value={kpis ? `${(kpis.totalStock / 1000).toFixed(1)} ton` : "--"}
          icon={Package}
          loading={kpisLoading}
        />
        <KpiCard
          title="Net Bakiye"
          value={kpis ? formatCurrency(kpis.netBalance) : "--"}
          icon={Wallet}
          loading={kpisLoading}
          color={kpis ? (kpis.netBalance >= 0 ? "text-green-600" : "text-red-600") : ""}
        />
      </div>

      {/* Monthly Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aylık Alım / Satış</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {chartLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chartData && chartData.some((d) => d.purchases > 0 || d.sales > 0) ? (
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
                <Bar dataKey="purchases" name="Alım" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" name="Satış" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Grafik verisi yok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Due Items */}
      {!dueLoading && dueItems && dueItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vadesi Yaklaşanlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {dueItems.map((item, i) => (
              <div key={item.id}>
                {i > 0 && <Separator />}
                <Link href="/finance/checks" className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {item.type}
                      </Badge>
                      {item.overdue && (
                        <Badge variant="secondary" className="shrink-0 bg-red-100 text-xs text-red-800">
                          Gecikmiş
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm">{item.contact_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(item.due_date)}</p>
                  </div>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Son İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {recentLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recent && recent.length > 0 ? (
            recent.map((item, i) => (
              <div key={`${item.type}-${item.id}`}>
                {i > 0 && <Separator />}
                <Link
                  href={item.type === "purchase" ? `/purchases/${item.id}` : `/sales/${item.id}`}
                  className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${
                          item.type === "purchase"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {item.type === "purchase" ? "Alım" : "Satış"}
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground font-mono">
                        {item.no}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm">{item.contact_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(item.date)}</p>
                  </div>
                </Link>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz işlem kaydı yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
