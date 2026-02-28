"use client";

import Link from "next/link";
import {
  useDashboardKpis,
  useMonthlyChart,
  useDailyTonnageChart,
  useWeeklyProfitChart,
  useFeedTypeDistribution,
  useRecentActivities,
  useSeasonSummary,
  useDueItems,
} from "@/lib/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  AlertTriangle,
  Truck,
  CircleDollarSign,
  Scale,
  FileText,
  Banknote,
  Plus,
  UserPlus,
  CreditCard,
  Trophy,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { SkeletonKpiCard, SkeletonChart, Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateShort, formatWeight } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";
import { openWhatsAppMessage, buildOdemeHatirlatmaMessage, buildCekVadeMessage } from "@/lib/utils/whatsapp";
import { useCarrierBalances } from "@/lib/hooks/use-carrier-transactions";
import { Onboarding } from "@/components/layout/onboarding";
import { useSeasonFilter } from "@/lib/contexts/season-context";

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════

/** Format currency compactly for mobile KPI cards */
function formatMobileAmount(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} milyon`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} bin`;
  return `${sign}${abs.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
}

// Color mappings for KPI decorative elements
const KPI_ICON_COLORS: Record<string, { icon: string; circle: string }> = {
  blue: { icon: "text-blue-600 dark:text-blue-400", circle: "bg-blue-100 dark:bg-blue-900/20" },
  purple: { icon: "text-purple-600 dark:text-purple-400", circle: "bg-purple-100 dark:bg-purple-900/20" },
  green: { icon: "text-primary", circle: "bg-primary/10" },
  red: { icon: "text-red-600 dark:text-red-400", circle: "bg-red-100 dark:bg-red-900/20" },
  amber: { icon: "text-amber-600 dark:text-amber-400", circle: "bg-amber-100 dark:bg-amber-900/20" },
  orange: { icon: "text-orange-600 dark:text-orange-400", circle: "bg-orange-100 dark:bg-orange-900/20" },
  teal: { icon: "text-teal-600 dark:text-teal-400", circle: "bg-teal-100 dark:bg-teal-900/20" },
  yellow: { icon: "text-yellow-600 dark:text-yellow-400", circle: "bg-yellow-100 dark:bg-yellow-900/20" },
};

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  color,
  iconColor = "green",
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  loading?: boolean;
  color?: string;
  iconColor?: string;
  href?: string;
}) {
  const kpiColors = KPI_ICON_COLORS[iconColor] || KPI_ICON_COLORS.green;

  const content = (
    <Card className={`relative overflow-hidden ${href ? "transition-colors hover:border-primary/30" : ""}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-28 sm:h-32">
        {/* Decorative corner circle */}
        <div className={`absolute -right-3 -top-3 h-14 w-14 rounded-full ${kpiColors.circle} transition-transform`} />
        <div className="relative z-10">
          <Icon className={`h-5 w-5 mb-1 ${kpiColors.icon}`} />
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">{title}</p>
        </div>
        {loading ? (
          <div className="space-y-1 relative z-10">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ) : (
          <div className="relative z-10">
            <p className={`text-lg sm:text-xl font-bold leading-tight truncate ${color || ""}`}>{value}</p>
            {subtitle && <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
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

function getBalanceLevel(amount: number): { color: string; bg: string; label: string } {
  if (amount >= 500_000) return { color: "text-red-600", bg: "bg-red-100", label: "Acil" };
  if (amount >= 200_000) return { color: "text-yellow-600", bg: "bg-yellow-100", label: "Dikkat" };
  return { color: "text-green-600", bg: "bg-green-100", label: "Normal" };
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════

export function DashboardContent() {
  const { selectedSeasonId } = useSeasonFilter();
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useDashboardKpis();
  const { data: chartData, isLoading: chartLoading, isError: chartError } = useMonthlyChart();
  const { data: dailyTonnage, isLoading: dailyLoading, isError: dailyError } = useDailyTonnageChart();
  const { data: weeklyProfit, isLoading: weeklyLoading, isError: weeklyError } = useWeeklyProfitChart();
  const { data: feedDist, isLoading: feedLoading, isError: feedError } = useFeedTypeDistribution();
  const { data: activities, isLoading: activitiesLoading, isError: activitiesError } = useRecentActivities();
  const { data: season, isLoading: seasonLoading, isError: seasonError } = useSeasonSummary(selectedSeasonId);
  const { data: dueItems, isLoading: dueLoading, isError: dueError } = useDueItems();
  const { data: carrierBalances, isLoading: carrierLoading, isError: carrierError } = useCarrierBalances();

  const hasAnyError = kpisError || chartError || dailyError || weeklyError || feedError || activitiesError || seasonError || dueError || carrierError;
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");
  /** Compact version for KPI cards — shows "142K" on mobile */
  const maskedCompact = (amount: number) => (isVisible ? formatMobileAmount(amount) : "••••");
  const tooltipFormatter = (value: number | undefined) => masked(value ?? 0);

  const [showFab, setShowFab] = useState(false);

  // Show onboarding when no data
  const showOnboarding =
    !kpisLoading &&
    kpis &&
    kpis.todayTruckCount === 0 &&
    kpis.monthProfit === 0 &&
    kpis.pendingReceivables === 0 &&
    kpis.pendingPayables === 0;

  return (
    <div className="space-y-4 page-enter">
      {hasAnyError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>Bazı veriler yüklenirken hata oluştu. İnternet bağlantınızı kontrol edin.</p>
        </div>
      )}
      <Onboarding show={!!showOnboarding} />
      {/* ═══ 6.1 — Günlük Özet Kartları (Üst sıra 4) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard
          title="Bugün Tır"
          value={kpis ? String(kpis.todayTruckCount) : "--"}
          icon={Truck}
          iconColor="blue"
          loading={kpisLoading}
          subtitle={kpis && kpis.todayTonnage > 0 ? formatWeight(kpis.todayTonnage) : undefined}
        />
        <KpiCard
          title="Bugün Tonaj"
          value={kpis ? formatWeight(kpis.todayTonnage) : "--"}
          icon={Scale}
          iconColor="purple"
          loading={kpisLoading}
        />
        <KpiCard
          title="Bugün Kâr"
          value={kpis ? maskedCompact(kpis.todayProfit) : "--"}
          icon={TrendingUp}
          iconColor="green"
          loading={kpisLoading}
          color={kpis ? (kpis.todayProfit >= 0 ? "text-green-600" : "text-red-600") : ""}
          href="/finance/profit"
        />
        <KpiCard
          title="Bu Ay Kâr"
          value={kpis ? maskedCompact(kpis.monthProfit) : "--"}
          icon={TrendingUp}
          iconColor="green"
          loading={kpisLoading}
          color={kpis ? (kpis.monthProfit >= 0 ? "text-green-600" : "text-red-600") : ""}
          href="/finance/profit"
        />
      </div>

      {/* Alt sıra (4 kart) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard
          title="Toplam Alacak"
          value={kpis ? maskedCompact(kpis.pendingReceivables) : "--"}
          icon={CircleDollarSign}
          iconColor="teal"
          loading={kpisLoading}
          color="text-red-600"
          href="/finance"
        />
        <KpiCard
          title="Toplam Borç"
          value={kpis ? maskedCompact(kpis.pendingPayables) : "--"}
          icon={CircleDollarSign}
          iconColor="orange"
          loading={kpisLoading}
          color="text-amber-600"
          href="/finance"
        />
        <KpiCard
          title="Vadesi Gelen"
          value={kpis ? `${kpis.dueCheckCount} adet` : "--"}
          subtitle={kpis && kpis.dueCheckTotal > 0 ? maskedCompact(kpis.dueCheckTotal) : undefined}
          icon={FileText}
          iconColor="yellow"
          loading={kpisLoading}
          color={kpis && kpis.overdueCheckCount > 0 ? "text-red-600" : "text-amber-600"}
          href="/finance/calendar"
        />
        <KpiCard
          title="Nakliye (Ay)"
          value={kpis ? maskedCompact(kpis.monthlyFreight) : "--"}
          icon={Truck}
          iconColor="red"
          loading={kpisLoading}
          color="text-orange-600"
        />
      </div>

      {/* ═══ 6.2 — Bakiye Uyarı Sistemi ═══ */}
      {!kpisLoading && kpis && (kpis.customerBalances.length > 0 || kpis.supplierBalances.length > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Dikkat Gerektiren Bakiyeler
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            {/* Müşteri alacakları */}
            {kpis.customerBalances.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Müşteri Alacakları</p>
                <div className="space-y-1">
                  {kpis.customerBalances.slice(0, 5).map((b) => {
                    const level = getBalanceLevel(b.balance);
                    const isOverLimit = b.credit_limit != null && b.credit_limit > 0 && b.balance > b.credit_limit;
                    return (
                      <div
                        key={b.contactId}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <Link href={`/finance/${b.contactId}`} className="flex items-center gap-2 min-w-0 flex-1">
                          {isOverLimit ? (
                            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 shrink-0">
                              LİMİT AŞIMI
                            </Badge>
                          ) : (
                            <Badge className={`${level.bg} ${level.color} text-[10px] px-1.5 py-0 shrink-0`}>
                              {level.label}
                            </Badge>
                          )}
                          <p className="text-xs sm:text-sm truncate">{b.name}</p>
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <p className={`text-xs sm:text-sm font-bold ${isOverLimit ? "text-red-600" : level.color}`}>{maskedCompact(b.balance)}</p>
                          {b.phone && (
                            <button
                              onClick={() =>
                                openWhatsAppMessage(
                                  b.phone,
                                  buildOdemeHatirlatmaMessage({ contactName: b.name, balance: b.balance })
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                              title="WhatsApp ile hatırlat"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>
                          )}
                          <Link href={`/finance/${b.contactId}`}>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {kpis.customerBalances.length > 0 && kpis.supplierBalances.length > 0 && (
              <Separator />
            )}

            {/* Tedarikçi borçları */}
            {kpis.supplierBalances.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Tedarikçi Borçları</p>
                <div className="space-y-1">
                  {kpis.supplierBalances.slice(0, 5).map((b) => {
                    const level = getBalanceLevel(b.balance);
                    return (
                      <div
                        key={b.contactId}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <Link href={`/finance/${b.contactId}`} className="flex items-center gap-2 min-w-0 flex-1">
                          <Badge className={`${level.bg} ${level.color} text-[10px] px-1.5 py-0 shrink-0`}>
                            {level.label}
                          </Badge>
                          <p className="text-xs sm:text-sm truncate">{b.name}</p>
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <p className={`text-xs sm:text-sm font-bold ${level.color}`}>{maskedCompact(b.balance)}</p>
                          {b.phone && (
                            <button
                              onClick={() =>
                                openWhatsAppMessage(
                                  b.phone,
                                  buildOdemeHatirlatmaMessage({ contactName: b.name, balance: b.balance })
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                              title="WhatsApp ile hatırlat"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>
                          )}
                          <Link href={`/finance/${b.contactId}`}>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ 7.5.5 — Nakliyeci Borç Kartı ═══ */}
      {!carrierLoading && carrierBalances && carrierBalances.filter((b) => b.balance > 0).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4" />
              Nakliyeci Borçları
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {carrierBalances
              .filter((b) => b.balance > 0)
              .slice(0, 5)
              .map((b) => (
                <Link
                  key={b.id}
                  href={`/settings/carriers/${b.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Truck className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                    <p className="text-xs sm:text-sm truncate">{b.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <p className="text-xs sm:text-sm font-bold text-orange-600">
                      {maskedCompact(b.balance)}
                    </p>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </Link>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Due Items Warning — Enhanced */}
      {!dueLoading && dueItems && dueItems.length > 0 && (() => {
        const overdue = dueItems.filter((i) => i.days_diff < 0);
        const todayDue = dueItems.filter((i) => i.days_diff === 0);
        const next3Days = dueItems.filter((i) => i.days_diff > 0 && i.days_diff <= 3);
        const thisWeek = dueItems.filter((i) => i.days_diff > 3 && i.days_diff <= 7);
        const later = dueItems.filter((i) => i.days_diff > 7);

        const categories: { label: string; color: string; badgeClass: string; items: typeof dueItems }[] = [];
        if (overdue.length > 0) categories.push({ label: "Vadesi GEÇMİŞ", color: "text-red-600", badgeClass: "bg-red-100 text-red-800", items: overdue });
        if (todayDue.length > 0) categories.push({ label: "Bugün Vadeli", color: "text-orange-600", badgeClass: "bg-orange-100 text-orange-800", items: todayDue });
        if (next3Days.length > 0) categories.push({ label: "3 Gün İçinde", color: "text-yellow-600", badgeClass: "bg-yellow-100 text-yellow-800", items: next3Days });
        if (thisWeek.length > 0) categories.push({ label: "Bu Hafta", color: "text-green-600", badgeClass: "bg-green-100 text-green-800", items: thisWeek });
        if (later.length > 0) categories.push({ label: "Yaklaşan", color: "text-blue-600", badgeClass: "bg-blue-100 text-blue-800", items: later });

        const getDaysLabel = (diff: number) => {
          if (diff < 0) return `${Math.abs(diff)} gün gecikmiş`;
          if (diff === 0) return "Bugün!";
          return `${diff} gün kaldı`;
        };

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Vadesi Yaklaşanlar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-3">
              {categories.map((cat) => (
                <div key={cat.label}>
                  <p className={`text-xs font-medium mb-1.5 ${cat.color}`}>{cat.label}</p>
                  <div className="space-y-1">
                    {cat.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <Link href="/finance/calendar" className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className={`shrink-0 text-[10px] px-1 py-0 ${cat.badgeClass}`}>
                              {item.type}
                            </Badge>
                            <p className="text-xs sm:text-sm truncate">{item.contact_name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className={`text-[10px] font-medium ${cat.color}`}>
                              {getDaysLabel(item.days_diff)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDateShort(item.due_date)}
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <p className="text-xs sm:text-sm font-bold">{masked(item.amount)}</p>
                          {item.contact_phone && (
                            <button
                              onClick={() =>
                                openWhatsAppMessage(
                                  item.contact_phone,
                                  buildCekVadeMessage({
                                    contactName: item.contact_name,
                                    amount: item.amount,
                                    type: item.raw_type,
                                    serialNo: item.serial_no || undefined,
                                    dueDate: item.due_date,
                                  })
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                              title="WhatsApp ile hatırlat"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* ═══ 6.3 — Charts ═══ */}

      {/* Chart 1: Daily Tonnage (last 30 days) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Günlük Sevkiyat (Son 30 Gün)</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {dailyLoading ? (
            <SkeletonChart />
          ) : dailyTonnage && dailyTonnage.some((d) => d.tonnage > 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyTonnage} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}t`} />
                <Tooltip
                  formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)} ton`, "Tonaj"]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="tonnage" name="Tonaj" fill="#166534" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Sevkiyat verisi yok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 2: Weekly Profit (last 12 weeks) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Haftalık Kâr Trendi (12 Hafta)</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {weeklyLoading ? (
            <SkeletonChart />
          ) : weeklyProfit && weeklyProfit.some((d) => d.profit !== 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weeklyProfit} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={formatCompact} />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Kâr"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Kâr verisi yok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 3: Feed Type Distribution + Monthly Chart side by side on wider screens */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Feed Type Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Yem Türü Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {feedLoading ? (
              <SkeletonChart />
            ) : feedDist && feedDist.length > 0 ? (
              <div className="flex items-center gap-2">
                <ResponsiveContainer width="60%" height={160}>
                  <PieChart>
                    <Pie
                      data={feedDist}
                      dataKey="tonnage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={false}
                    >
                      {feedDist.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number | undefined) => [`${v ?? 0} ton`, ""]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {feedDist.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-[10px] truncate">{item.name}</span>
                      <span className="text-[10px] font-medium ml-auto">{item.tonnage}t</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Veri yok.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Purchase/Sales Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aylık Alım / Satış</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {chartLoading ? (
              <SkeletonChart />
            ) : chartData && chartData.some((d) => d.purchases > 0 || d.sales > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={formatCompact} />
                  <Tooltip
                    formatter={tooltipFormatter}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="purchases" name="Alım" fill="#166534" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sales" name="Satış" fill="#d97706" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Grafik verisi yok.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 6.5 — Son Aktiviteler ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Son İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {activitiesLoading ? (
            <div className="space-y-3 px-4 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            activities.map((act, i) => {
              const IconComp =
                act.icon === "truck" ? Truck : act.icon === "banknote" ? Banknote : FileText;
              const iconBg =
                act.type === "delivery"
                  ? "bg-green-100 text-green-600"
                  : act.type === "payment"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-amber-100 text-amber-600";

              return (
                <div key={act.id}>
                  {i > 0 && <Separator />}
                  <Link
                    href={act.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{act.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDateShort(act.date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {act.amount != null && (
                        <p className="text-sm font-bold">{masked(act.amount)}</p>
                      )}
                      {act.weight != null && (
                        <p className="text-sm font-bold">{formatWeight(act.weight)}</p>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz işlem yok.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══ 6.6 — Sezon Performans Özeti ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4" />
            Sezon Özeti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          {seasonLoading ? (
            <div className="space-y-3 px-4 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : season ? (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Toplam Tonaj</p>
                  <p className="text-sm font-bold">{formatWeight(season.totalTonnage)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Toplam Ciro</p>
                  <p className="text-xs sm:text-sm font-bold truncate">{maskedCompact(season.totalRevenue)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Toplam Kâr</p>
                  <p className={`text-xs sm:text-sm font-bold truncate ${season.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {maskedCompact(season.totalProfit)}
                  </p>
                </div>
              </div>

              {/* Top lists */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Top Customers */}
                {season.topCustomers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">En Çok Satılan</p>
                    {season.topCustomers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs truncate">{i + 1}. {c.name}</p>
                        <p className="text-xs font-medium">{formatWeight(c.tonnage)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top Suppliers */}
                {season.topSuppliers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">En Çok Alınan</p>
                    {season.topSuppliers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs truncate">{i + 1}. {c.name}</p>
                        <p className="text-xs font-medium">{formatWeight(c.tonnage)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top Carriers/Plates */}
                {(season.topCarriers.length > 0 || season.topPlates.length > 0) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">En Çok Nakliye</p>
                    {season.topPlates.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs font-mono truncate">{i + 1}. {p.plate}</p>
                        <p className="text-xs font-medium">{p.count} sefer</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ═══ 6.4 — Floating Action Button ═══ */}
      <div className="fixed bottom-24 sm:bottom-20 right-4 z-50">
        {showFab && (
          <div className="mb-2 flex flex-col gap-2 items-end animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Link href="/sales">
              <Button size="sm" className="gap-2 rounded-full bg-green-600 hover:bg-green-700 shadow-lg">
                <Truck className="h-4 w-4" />
                Hızlı Sevkiyat
              </Button>
            </Link>
            <Link href="/finance/payments/new">
              <Button size="sm" className="gap-2 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg">
                <Banknote className="h-4 w-4" />
                Ödeme / Tahsilat
              </Button>
            </Link>
            <Link href="/contacts/new">
              <Button size="sm" className="gap-2 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg">
                <UserPlus className="h-4 w-4" />
                Yeni Kişi
              </Button>
            </Link>
            <Link href="/finance/checks/new">
              <Button size="sm" className="gap-2 rounded-full bg-amber-600 hover:bg-amber-700 shadow-lg">
                <CreditCard className="h-4 w-4" />
                Çek / Senet
              </Button>
            </Link>
          </div>
        )}
        <Button
          size="icon"
          className={`h-14 w-14 rounded-full shadow-xl transition-transform ${showFab ? "rotate-45 bg-muted-foreground" : "bg-primary"}`}
          onClick={() => setShowFab((v) => !v)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
