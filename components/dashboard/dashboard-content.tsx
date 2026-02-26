"use client";

import Link from "next/link";
import {
  useDashboardKpis,
  useMonthlyChart,
  useRecentDeliveries,
  useDueItems,
} from "@/lib/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  Wallet,
  Loader2,
  AlertTriangle,
  Truck,
  CircleDollarSign,
  Scale,
  FileText,
} from "lucide-react";
import { formatCurrency, formatDateShort, formatWeight } from "@/lib/utils/format";
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

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  color,
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  loading?: boolean;
  color?: string;
  href?: string;
}) {
  const content = (
    <Card className={href ? "transition-colors hover:bg-muted/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? (
          <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <p className={`mt-1 text-lg font-bold ${color || ""}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export function DashboardContent() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: chartData, isLoading: chartLoading } = useMonthlyChart();
  const { data: recentDeliveries, isLoading: deliveriesLoading } = useRecentDeliveries();
  const { data: dueItems, isLoading: dueLoading } = useDueItems();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";
  const tooltipFormatter = (value: number | undefined) => masked(value ?? 0);

  return (
    <div className="space-y-4">
      {/* KPI Cards — 2x3 grid */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          title="Bugünkü Kar"
          value={kpis ? masked(kpis.todayProfit) : "--"}
          icon={TrendingUp}
          loading={kpisLoading}
          color={kpis ? (kpis.todayProfit >= 0 ? "text-green-600" : "text-red-600") : ""}
          href="/finance/profit"
        />
        <KpiCard
          title="Bu Ay Ciro"
          value={kpis ? masked(kpis.monthlyRevenue) : "--"}
          icon={Wallet}
          loading={kpisLoading}
        />
        <KpiCard
          title="Bu Ay Tonaj"
          value={kpis ? formatWeight(kpis.monthlyTonnage) : "--"}
          icon={Scale}
          loading={kpisLoading}
        />
        <KpiCard
          title="Aktif Satışlar"
          value={kpis ? String(kpis.activeSalesCount) : "--"}
          icon={FileText}
          loading={kpisLoading}
        />
        <KpiCard
          title="Bekleyen Tahsilat"
          value={kpis ? masked(kpis.pendingReceivables) : "--"}
          icon={CircleDollarSign}
          loading={kpisLoading}
          color="text-amber-600"
          href="/finance"
        />
        <KpiCard
          title="Bekleyen Ödeme"
          value={kpis ? masked(kpis.pendingPayables) : "--"}
          icon={CircleDollarSign}
          loading={kpisLoading}
          color="text-red-600"
          href="/finance"
        />
      </div>

      {/* Due Checks Warning */}
      {!kpisLoading && kpis && kpis.dueCheckCount > 0 && (
        <Link href="/finance/calendar">
          <Card className={kpis.overdueCheckCount > 0 ? "border-red-200 bg-red-50/50" : "border-yellow-200 bg-yellow-50/50"}>
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className={`h-5 w-5 ${kpis.overdueCheckCount > 0 ? "text-red-500" : "text-yellow-500"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {kpis.overdueCheckCount > 0
                    ? `${kpis.overdueCheckCount} gecikmiş, ${kpis.dueCheckCount - kpis.overdueCheckCount} yaklaşan`
                    : `${kpis.dueCheckCount} çek/senet vadesi yaklaşıyor`}
                </p>
                <p className="text-xs text-muted-foreground">7 gün içinde</p>
              </div>
              <p className="text-sm font-bold text-amber-600">{masked(kpis.dueCheckTotal)}</p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Top Balances — Customers & Suppliers */}
      {!kpisLoading && kpis && (kpis.topCustomers.length > 0 || kpis.topSuppliers.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {kpis.topCustomers.length > 0 && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground">En Yüksek Alacak</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-4 pb-3">
                {kpis.topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="truncate text-xs">{c.name}</p>
                    <p className="shrink-0 text-xs font-bold text-red-600">{masked(c.balance)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {kpis.topSuppliers.length > 0 && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground">En Yüksek Borç</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-4 pb-3">
                {kpis.topSuppliers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="truncate text-xs">{c.name}</p>
                    <p className="shrink-0 text-xs font-bold text-amber-600">{masked(c.balance)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
                <Bar dataKey="purchases" name="Alım" fill="#166534" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" name="Satış" fill="#d97706" radius={[4, 4, 0, 0]} />
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
                <Link href="/finance/calendar" className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50">
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
                    <p className="text-sm font-bold">{masked(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(item.due_date)}</p>
                  </div>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Deliveries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4" />
            Son Sevkiyatlar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {deliveriesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentDeliveries && recentDeliveries.length > 0 ? (
            recentDeliveries.map((item, i) => (
              <div key={item.id}>
                {i > 0 && <Separator />}
                <Link
                  href={item.type === "sale" ? "/sales" : "/purchases"}
                  className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${
                          item.type === "purchase"
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.type === "purchase" ? "Alım" : "Satış"}
                      </Badge>
                      {item.vehicle_plate && (
                        <span className="truncate text-xs text-muted-foreground font-mono">
                          {item.vehicle_plate}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm">{item.contact_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{formatWeight(item.net_weight)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(item.delivery_date)}</p>
                  </div>
                </Link>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz sevkiyat kaydı yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
